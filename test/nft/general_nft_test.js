const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

const expect = chai.expect;
const { ethers, upgrades } = require("hardhat");

describe("NFT", function () {
    const contracts = {};
    let owner, user1, user2;

    before("Deploy contracts", async function () {
        this.timeout(120000);
        [owner, user1, user2] = await ethers.getSigners();
        const NFT = await ethers.getContractFactory("SimpleERC721");
        contracts.pet = await upgrades.deployProxy(NFT)
        await contracts.pet.deployed();
        console.log('address',contracts.pet.address)
    });

    it("can get symbol of nft contract", async () => {
        expect(await contracts.pet.symbol()).to.be.equal("SE721");
    });

    it("cannot initialize a second time", async () => {
        return expect(contracts.pet.initialize()).eventually.be.rejectedWith('Initializable: contract is already initialized');
    });

    it("mint one pet", async function () {
        const minted = await contracts.pet.mintBuy(owner.address, 1, 1, {gasLimit: 70_000_000});
        const tokenId = await contracts.pet.tokenOfOwnerByIndex(owner.address,0);
    });

    it("get tokenUri + owner", async function () {
        const tokenId = await contracts.pet.tokenOfOwnerByIndex(owner.address,0);
        const tokenUri = await contracts.pet.tokenURI(tokenId);
        const nftOwner = await contracts.pet.ownerOf(tokenId);
        expect(tokenUri).to.be.a('string').and.satisfy(msg => msg.startsWith('xxx'));
        expect(nftOwner).to.equal(owner.address);
    });

    it("change prefix the mint ", async function () {
        // Change prefix
        let prefix = 'https://google.com/pet/';
        let suffix = '.json';
        await contracts.pet.setTokenURIAffixes(prefix, suffix);
        const tokenId = await contracts.pet.tokenOfOwnerByIndex(owner.address,0);
        const tokenUri = await contracts.pet.tokenURI(tokenId);
        expect(tokenUri).to.be.a('string').and.satisfy(msg => msg.startsWith('https://google.com/pet/'));
    });
});
