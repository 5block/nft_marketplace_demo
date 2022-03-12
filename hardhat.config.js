/* eslint import/no-extraneous-dependencies: 0 */
require('@nomiclabs/hardhat-waffle');
const fs = require('fs');

// const mnemonic = fs.readFileSync('.secret').toString().trim();
// const { mnemonic } = require('./secrets.json');
require('@nomiclabs/hardhat-solhint');
require('hardhat-gas-reporter');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-deploy');
require('@nomiclabs/hardhat-ethers');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    defaultNetwork: 'hardhat',
    networks: {
        local: {
            url: 'http://127.0.0.1:8545',
        },
        hardhat: {
            blockGasLimit: 70000000,
        },
        testnet: {
            url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
            chainId: 97,
            gasPrice: 'auto',
            accounts: { mnemonic },
            gas: 20000000,
            timeout: 120000,
            throwOnTransactionFailures: true,
        },
        mainnet: {
            url: 'https://bsc-dataseed.binance.org/',
            chainId: 56,
            gasPrice: 'auto',
            accounts: { mnemonic },
            gas: 20000000,
            timeout: 120000,
            throwOnTransactionFailures: true,
        },
    },
    solidity: {
        version: '0.8.4',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
            56: 0,
        },

        priceFeed: {
            56: '0x87ea38c9f24264ec1fff41b04ec94a97caf99941', // chainlink oracle
            97: '0x0630521aC362bc7A19a4eE44b57cE72Ea34AD01c', // chainlink oracle
        },

        busdAddress: {
            56: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
            97: '0xed24fc36d5ee211ea25a80239fb8c4cfd80f12ee',
        },
    },
    paths: {
        deploy: 'scripts/deploy',
        deployments: 'deployments',
        imports: 'imports',
    },
};
