const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { expect } = chai;
const { ethers, upgrades } = require('hardhat');
const BN = ethers.BigNumber;

async function getTestToken(address, nftContract) {
    return (await nftContract.tokenOfOwnerByIndex(address, 0)).toHexString();
}

describe('NFT Marketplace', () => {
    const contracts = {};
    const tokens = {};
    let owner; let user1; let
        user2;
    let feeRate = 15;
    const price = 10000;

    before('Deploy contracts and mint some NFTs', async () => {
        [owner, user1, user2] = await ethers.getSigners();

        const NFT = await ethers.getContractFactory('SimpleERC721');
        const Marketplace = await ethers.getContractFactory('Marketplace');

        contracts.nft = await upgrades.deployProxy(NFT);
        contracts.marketplace = await upgrades.deployProxy(Marketplace, [feeRate]);

        await contracts.nft.deployed();
        await contracts.marketplace.deployed();

        // mint some nfts
        tokens[user1] = [];
        for (let i = 1; i <= 10; i += 1) {
            tokens[user1].push(ethers.utils.id(`token${i}`));
        }
        await contracts.nft.batchMint(user1.address, tokens[user1], 1);

        contracts.user1 = {
            nft: contracts.nft.connect(user1),
            marketplace: contracts.marketplace.connect(user1),
        };
        contracts.user2 = {
            nft: contracts.nft.connect(user2),
            marketplace: contracts.marketplace.connect(user2),
        };
    });

    it('can get address of nft and marketplace contracts', async () => {
        expect(await contracts.nft.address).to.be.a('string');
        expect(await contracts.marketplace.address).to.be.a('string');
    });

    describe('Tradings with native currency', () => {
        it('cannot create a trading without approval', async () => {
            const tokenId = await getTestToken(user1.address, contracts.nft);
            expect(
                contracts.user1.marketplace.createTrading(
                    contracts.nft.address,
                    tokenId,
                    price,
                    ethers.constants.AddressZero,
                ),
            ).eventually.be.rejected;
        });

        describe('Create trading - Buy a NFT', async () => {
            let tokenId;
            it('can create a trading after approval', async () => {
                tokenId = await getTestToken(user1.address, contracts.nft);
                await contracts.user1.nft.approve(contracts.marketplace.address, tokenId);
                await contracts.user1.marketplace.createTrading(
                    contracts.nft.address,
                    tokenId,
                    price,
                    ethers.constants.AddressZero,
                );
                const trading = await contracts.marketplace.tradings(contracts.nft.address, tokenId);
                expect(trading.seller).to.be.equal(user1.address);
                expect(trading.price.eq(price)).to.be.true;
                expect(trading.startAt.gt(0)).to.be.true;
                expect(trading.currency).to.be.equal(ethers.constants.AddressZero);
            });

            it('cannot buy without enough currency', async () => {
                expect(
                    contracts.user2.marketplace.buy(contracts.nft.address, tokenId, { value: price - 1 }),
                ).eventually.be.rejected;
            });

            it('can buy with more than enough currency', async () => {
                const currentContractBalance = await ethers.provider.getBalance(contracts.marketplace.address);
                const currentSellerBalance = await ethers.provider.getBalance(user1.address);
                const currentBuyerBalance = await ethers.provider.getBalance(user2.address);

                await contracts.user2.marketplace.buy(contracts.nft.address, tokenId, { value: price });
                expect(await contracts.nft.ownerOf(tokenId)).to.be.equal(user2.address);

                const newContractBalance = await ethers.provider.getBalance(contracts.marketplace.address);
                const newSellerBalance = await ethers.provider.getBalance(user1.address);
                const newBuyerBalance = await ethers.provider.getBalance(user2.address);

                expect(newContractBalance.eq(currentContractBalance.add(price / 100 * feeRate)));
                expect(newSellerBalance.eq(currentSellerBalance.add(price / 100 * (100 - feeRate))));
                expect(newBuyerBalance.lte(currentBuyerBalance.sub(price)));
            });
        });

        it('cannot cancel after sold', async () => {
            const tokenId = await getTestToken(user1.address, contracts.nft);
            await contracts.user1.nft.approve(contracts.marketplace.address, tokenId);
            await contracts.user1.marketplace.createTrading(
                contracts.nft.address,
                tokenId,
                price,
                ethers.constants.AddressZero,
            );

            await contracts.user2.marketplace.buy(contracts.nft.address, tokenId, { value: price });
            expect(contracts.user1.marketplace.cancelTrading(contracts.nft.address, tokenId)).eventually.be.rejected;
        });

        it("cannot cancel other's trading", async () => {
            const tokenId = await getTestToken(user1.address, contracts.nft);
            await contracts.user1.nft.approve(contracts.marketplace.address, tokenId);
            await contracts.user1.marketplace.createTrading(
                contracts.nft.address,
                tokenId,
                price,
                ethers.constants.AddressZero,
            );

            expect(contracts.user2.marketplace.cancelTrading(contracts.nft.address, tokenId)).eventually.be.rejected;
        });

        it('can cancel', async () => {
            const tokenId = await getTestToken(user1.address, contracts.nft);
            await contracts.user1.nft.approve(contracts.marketplace.address, tokenId);
            await contracts.user1.marketplace.createTrading(
                contracts.nft.address,
                tokenId,
                price,
                ethers.constants.AddressZero,
            );

            await contracts.user1.marketplace.cancelTrading(contracts.nft.address, tokenId);
            expect(await contracts.nft.ownerOf(tokenId)).to.be.equal(user1.address);
        });
    });

    describe('Tradings with ERC20', () => {
        before('deploy erc20 token', async () => {
            const ERC20 = await ethers.getContractFactory('TestERC20');
            contracts.erc20 = await ERC20.deploy(BN.from('10000000000000'));
            contracts.user2.erc20 = contracts.erc20.connect(user2);

            // give user2 some tokens to spend
            await contracts.erc20.transfer(user2.address, price * 10);
        });

        it('cannot create a trading without approval for token', async () => {
            const tokenId = await getTestToken(user1.address, contracts.nft);
            return expect(
                contracts.user1.marketplace.createTrading(
                    contracts.nft.address,
                    tokenId,
                    price,
                    contracts.erc20.address,
                ),
            ).eventually.be.rejectedWith('Currency not allowed');
        });

        describe('Create trading - Buy a NFT', async () => {
            let tokenId;
            it('can create a trading after approval of currency', async () => {
                tokenId = await getTestToken(user1.address, contracts.nft);
                await contracts.marketplace.addCurrency(contracts.erc20.address);
                await contracts.user1.nft.approve(contracts.marketplace.address, tokenId);
                await contracts.user1.marketplace.createTrading(
                    contracts.nft.address,
                    tokenId,
                    price,
                    contracts.erc20.address,
                );
                const trading = await contracts.marketplace.tradings(contracts.nft.address, tokenId);
                expect(trading.seller).to.be.equal(user1.address);
                expect(trading.price.eq(price)).to.be.true;
                expect(trading.startAt.gt(0)).to.be.true;
                expect(trading.currency).to.be.equal(contracts.erc20.address);
            });

            it('cannot buy without approve spend token', async () => {
                expect(
                    contracts.user2.marketplace.buy(contracts.nft.address, tokenId),
                ).eventually.be.rejectedWith('ERC20: transfer amount exceeds allowance');
            });

            it('cannot buy without enough token', async () => {
                await contracts.user2.erc20.approve(contracts.marketplace.address, 9999);
                expect(
                    contracts.user2.marketplace.buy(contracts.nft.address, tokenId),
                ).eventually.be.rejectedWith('ERC20: transfer amount exceeds allowance');
            });

            it('can buy with more than enough token', async () => {
                const currentContractBalance = await contracts.erc20.balanceOf(contracts.marketplace.address);
                const currentSellerBalance = await contracts.erc20.balanceOf(user1.address);
                const currentBuyerBalance = await contracts.erc20.balanceOf(user2.address);

                await contracts.user2.erc20.approve(contracts.marketplace.address, price);
                await contracts.user2.marketplace.buy(contracts.nft.address, tokenId);
                expect(await contracts.nft.ownerOf(tokenId)).to.be.equal(user2.address);

                const newContractBalance = await contracts.erc20.balanceOf(contracts.marketplace.address);
                const newSellerBalance = await contracts.erc20.balanceOf(user1.address);
                const newBuyerBalance = await contracts.erc20.balanceOf(user2.address);

                expect(newContractBalance.eq(currentContractBalance.add(price / 100 * feeRate))).to.be.true;
                expect(newSellerBalance.eq(currentSellerBalance.add(price / 100 * (100 - feeRate)))).to.be.true;
                expect(newBuyerBalance.eq(currentBuyerBalance.sub(price))).to.be.true;
            });
        });

        it('cannot cancel after sold', async () => {
            const tokenId = await getTestToken(user1.address, contracts.nft);
            await contracts.user1.nft.approve(contracts.marketplace.address, tokenId);
            await contracts.user1.marketplace.createTrading(
                contracts.nft.address,
                tokenId,
                price,
                ethers.constants.AddressZero,
            );

            await contracts.user2.marketplace.buy(contracts.nft.address, tokenId, { value: price });
            expect(contracts.user1.marketplace.cancelTrading(contracts.nft.address, tokenId)).eventually.be.rejected;
        });

        it("cannot cancel other's trading", async () => {
            const tokenId = await getTestToken(user1.address, contracts.nft);
            await contracts.user1.nft.approve(contracts.marketplace.address, tokenId);
            await contracts.user1.marketplace.createTrading(
                contracts.nft.address,
                tokenId,
                price,
                ethers.constants.AddressZero,
            );

            expect(contracts.user2.marketplace.cancelTrading(contracts.nft.address, tokenId)).eventually.be.rejected;
        });

        it('can cancel', async () => {
            const tokenId = await getTestToken(user1.address, contracts.nft);
            await contracts.user1.nft.approve(contracts.marketplace.address, tokenId);
            await contracts.user1.marketplace.createTrading(
                contracts.nft.address,
                tokenId,
                price,
                ethers.constants.AddressZero,
            );

            await contracts.user1.marketplace.cancelTrading(contracts.nft.address, tokenId);
            expect(await contracts.nft.ownerOf(tokenId)).to.be.equal(user1.address);
        });
    });

    describe('Special Fee', () => {
        it('can set special fee for nft contract address', async () => {
            const currentSpecialFee = await contracts.marketplace.specialFee(contracts.nft.address);
            expect(currentSpecialFee.enabled).to.equal(false);

            await contracts.marketplace.setSpecialFee(contracts.nft.address, 5);
            const newSpecialFee = await contracts.marketplace.specialFee(contracts.nft.address);
            expect(newSpecialFee.enabled).to.equal(true);
            expect(newSpecialFee.rate.eq(5)).to.be.true;
        });

        it('can remove special fee for nft contract address', async () => {
            const currentSpecialFee = await contracts.marketplace.specialFee(contracts.nft.address);
            expect(currentSpecialFee.enabled).to.equal(true);

            await contracts.marketplace.removeSpecialFee(contracts.nft.address);
            const newSpecialFee = await contracts.marketplace.specialFee(contracts.nft.address);
            expect(newSpecialFee.enabled).to.equal(false);
        });

        it('can remove non existent nft contract address', async () => {
            expect(await contracts.marketplace.removeSpecialFee(contracts.nft.address)).to.be.ok;
        });

        it('change fee according to special fee - native currency', async () => {
            feeRate = 5;
            await contracts.marketplace.setSpecialFee(contracts.nft.address, feeRate);

            // user1 puts a token on sale
            tokenId = await getTestToken(user1.address, contracts.nft);
            await contracts.user1.nft.approve(contracts.marketplace.address, tokenId);
            await contracts.user1.marketplace.createTrading(
                contracts.nft.address,
                tokenId,
                price,
                ethers.constants.AddressZero,
            );

            const currentContractBalance = await ethers.provider.getBalance(contracts.marketplace.address);
            const currentSellerBalance = await ethers.provider.getBalance(user1.address);
            const currentBuyerBalance = await ethers.provider.getBalance(user2.address);

            // user2 buys the token
            await contracts.user2.marketplace.buy(contracts.nft.address, tokenId, { value: price });
            expect(await contracts.nft.ownerOf(tokenId)).to.be.equal(user2.address);

            const newContractBalance = await ethers.provider.getBalance(contracts.marketplace.address);
            const newSellerBalance = await ethers.provider.getBalance(user1.address);
            const newBuyerBalance = await ethers.provider.getBalance(user2.address);

            expect(newContractBalance.eq(currentContractBalance.add(price / 100 * feeRate))).to.be.true;
            expect(newSellerBalance.eq(currentSellerBalance.add(price / 100 * (100 - feeRate)))).to.be.true;
            expect(newBuyerBalance.lte(currentBuyerBalance.sub(price))).to.be.true;
        });

        it('change fee according to special fee - erc20', async () => {
            feeRate = 5;
            await contracts.marketplace.setSpecialFee(contracts.nft.address, feeRate);

            // user1 puts a token on sale
            tokenId = await getTestToken(user1.address, contracts.nft);
            await contracts.user1.nft.approve(contracts.marketplace.address, tokenId);
            await contracts.user1.marketplace.createTrading(
                contracts.nft.address,
                tokenId,
                price,
                contracts.erc20.address,
            );

            const currentContractBalance = await contracts.erc20.balanceOf(contracts.marketplace.address);
            const currentSellerBalance = await contracts.erc20.balanceOf(user1.address);
            const currentBuyerBalance = await contracts.erc20.balanceOf(user2.address);

            // user2 buys the token
            await contracts.user2.erc20.approve(contracts.marketplace.address, price);
            await contracts.user2.marketplace.buy(contracts.nft.address, tokenId);
            expect(await contracts.nft.ownerOf(tokenId)).to.be.equal(user2.address);

            const newContractBalance = await contracts.erc20.balanceOf(contracts.marketplace.address);
            const newSellerBalance = await contracts.erc20.balanceOf(user1.address);
            const newBuyerBalance = await contracts.erc20.balanceOf(user2.address);

            expect(newContractBalance.eq(currentContractBalance.add(price / 100 * feeRate))).to.be.true;
            expect(newSellerBalance.eq(currentSellerBalance.add(price / 100 * (100 - feeRate)))).to.be.true;
            expect(newBuyerBalance.eq(currentBuyerBalance.sub(price))).to.be.true;
        });
    });

    describe('Admin withdraw funds', () => {
        it('admin can withdraw native currency', async () => {
            const currentContractBalance = await ethers.provider.getBalance(contracts.marketplace.address);
            const currentOwnerBalance = await ethers.provider.getBalance(owner.address);

            const tx = await contracts.marketplace.adminClaim(ethers.constants.AddressZero);
            const receipt = await tx.wait();
            const expectedBalance = currentOwnerBalance.sub(receipt.gasUsed.mul(receipt.effectiveGasPrice)).add(currentContractBalance);

            const newContractBalance = await ethers.provider.getBalance(contracts.marketplace.address);
            const newOwnerBalance = await ethers.provider.getBalance(owner.address);

            expect(newContractBalance.eq(0)).to.be.true;
            expect(newOwnerBalance.eq(expectedBalance)).to.be.true;
        });

        it('admin can withdraw erc20', async () => {
            const currentContractBalance = await contracts.erc20.balanceOf(contracts.marketplace.address);
            const currentOwnerBalance = await contracts.erc20.balanceOf(owner.address);

            await contracts.marketplace.adminClaim(contracts.erc20.address);

            const newContractBalance = await contracts.erc20.balanceOf(contracts.marketplace.address);
            const newOwnerBalance = await contracts.erc20.balanceOf(owner.address);

            expect(newContractBalance.eq(0)).to.be.true;
            expect(newOwnerBalance.eq(currentOwnerBalance.add(currentContractBalance))).to.be.true;
        });

        it('others cannot withdraw native currency', async () => expect(contracts.user1.marketplace.adminClaim(ethers.constants.AddressZero)).eventually.be.rejectedWith('AccessControl'));

        it('others cannot withdraw erc20', async () => expect(contracts.user1.marketplace.adminClaim(contracts.erc20.address)).eventually.be.rejectedWith('AccessControl'));
    });
});
