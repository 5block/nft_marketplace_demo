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
        contracts.pet = await NFT.deploy()
        await contracts.pet.deployed();
        console.log('address',contracts.pet.address)
    });

    it("can get symbol of nft contract", async () => {
        expect(await contracts.pet.symbol()).to.be.equal("SE721");
    });

    it("mint one pet", async function () {
        
        const minted = await contracts.pet.mint(owner.address);
        const tokenId = await contracts.pet.tokenOfOwnerByIndex(owner.address,0);
    });

    it("get tokenUri + owner", async function () {
        const tokenId = await contracts.pet.tokenOfOwnerByIndex(owner.address,0);
        const tokenUri = await contracts.pet.tokenURI(tokenId);
        const nftOwner = await contracts.pet.ownerOf(tokenId);
        // expect(tokenUri).to.be.a('string').and.satisfy(msg => msg.startsWith('xxx'));
        expect(tokenUri).to.be.a('string').and.satisfy(msg => msg.startsWith('https'));
        expect(nftOwner).to.equal(owner.address);
    });

    it("Pauses all token transfers", async function () {
        await contracts.pet.pause();
        expect(await contracts.pet.paused()).to.be.true;
    });

    it("Un-pauses all token transfers", async function () {
        await contracts.pet.unpause();
        expect(await contracts.pet.paused()).to.be.false;
    });
});
