const ethers = require('ethers');
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');
const { weiToEth, ethToWei } = require('./utils');

const SC = '0xCF205808Ed36593aa40a44F10c7f7C2F67d4A4d4'
const provider = new ethers.WebSocketProvider('wss://base.publicnode.com')
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY_FT);
console.log("wallet", wallet.address);

const gasPrice = ethers.parseUnits('0.000000001', 'ether');

const account = wallet.connect(provider);
const friendTech = new ethers.Contract(
    SC,
    [
        'function sharesSupply(address sharesSubject) public view returns (uint256)',
        'function sharesBalance(address sharesSubject, address holder) public view returns (uint256)',
        'function sellShares(address sharesSubject, uint256 amount) public payable',
        'function buyShares(address arg0, uint256 arg1)',
        'function getBuyPriceAfterFee(address sharesSubject, uint256 amount) public view returns (uint256)',
        'event Trade(address trader, address subject, bool isBuy, uint256 shareAmount, uint256 ethAmount, uint256 protocolEthAmount, uint256 subjectEthAmount, uint256 supply)',
    ],
    account
);

const blockList = [
    "0xaffF27468fd68C115F0ccC0e790adD0087C1c01b"
]

const topGlobalList = [
    "0x976e80df570e6f314396300ea77cb2e7b2f84172",
    "0xfd7232e66a69e1ae01e1e0ea8fab4776e2d325a9",
    "0xf9b7cf4be6f4cde37dd1a5b75187d431d94a4fcc",
    "0xef42b587e4a3d33f88fa499be1d80c676ff7a226",
    "0xe3354409644c8f791885ab232d43073782638704",
    "0x5479f127a4d594208549c86f4b4903a1175a0311",
    "0xbdc0dc2c00f022513511d915aff99fdd82d818a9",
    "0xc2d56007289c28848fcce65859b3701ce5ab75d9",
    "0xc4eefdd834865882c3725e56afa6900fd83fec87",
    "0x4ff9939edf3db7c1dca1b4b2c1d60a623f7ca06f",
    "0xef5391a73e2cb70ae0435b4395a8db4beaec1934",
    "0x88ab3976d11db0ffa5e555ac846e90152db1ce32",
    "0x4e5f7e4a774bd30b9bdca7eb84ce3681a71676e1",
    "0xe9825fd47c5d863b1aecba3707abcc7c8b49b88d",
    "0x4ec86d29bd3a1926ca390bc4e8f3f0c2bcc816ba",
    "0xd42f9e515f0422952cb75131302512513648e9d3",
    "0xbc6da4703841127bfe7a09595507f2cbacf52f9c",
    "0xa84bd0e9646170b91c75a999332954a15e4969b3",
    "0x3931344ba6a2c98450bc82e412db5e70d15c9ded"
]

let alreadyBought = [];

try {
    const fileContents = fs.readFileSync('./buysFT.txt', 'utf8');
    alreadyBought = JSON.parse(fileContents);
} catch (error) {
    console.error('Error reading or parsing the "buys" file:', error);
}

const checkUser = async (targetUser) => {
    const apiUrl = `https://prod-api.kosetto.com/users/${targetUser}`;
    try {
        const res = await axios.get(apiUrl, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
        return res?.data
    } catch (err) {
        if (axios.isAxiosError(err) && err.response && err.response.status === 404) {
            console.error('HTTP 404 error occurred');
        } else {
            console.log('Error occurred, but it is suppressed:');
        }
        return null
    }
}

const isBuying = async (buyerBalance, targetAddress, isBuy) => {
    return (
        // topGlobalList.includes(target) &&
        !blockList.includes(targetAddress) &&
        isBuy &&
        buyerBalance >= await ethToWei("0.08")
        // buyer >= await ethToWei("0.05") &&
        // weiBalance >= await ethToWei("0.03") &&
        // isBuy &&
        // weiBalance <= await ethToWei("30") // Change 'weiBalance <=' to 'weiBalance.lte'
        // supply > 4n // Use 'gt' instead of '>'
    );
};

const checkHolderTop = async (buyerAddress) => {
    for (const address in topGlobalList) {
        let bal = await friendTech.sharesBalance(address, buyerAddress);
        if (bal > 0) {
            return true
        }
        return false;
    }
}

const checkBuyerPrice = async (targetAddress) => {
    const targetBP = await friendTech.getBuyPriceAfterFee(targetAddress, 1);
    const tp = await weiToEth(targetBP)
    if (tp >= '0.2') {
        return true
    }
    return false
}

const processTradeEvent = async (event) => {
    const {
        [0]: buyerAddress,
        [1]: targetAddress,
        [2]: isBuy,
        [3]: shareAmount,
        [4]: ethAmount,
        [5]: protocolEthAmount,
        [6]: subjectEthAmount,
        [7]: supply,
    } = event.args;

    const weiTargetBalance = await provider.getBalance(targetAddress);
    const weiBuyerBalance = await provider.getBalance(buyerAddress);
    const targetBalance = await weiToEth(weiTargetBalance);
    const buyerBalance = await weiToEth(weiBuyerBalance);

    const buyOne = await friendTech.getBuyPriceAfterFee(buyerAddress, 1)
    const bo = await weiToEth(buyOne);

    const targetBuyPrice = await friendTech.getBuyPriceAfterFee(targetAddress, 1)
    const tp = await weiToEth(targetBuyPrice);

    // if (targetAddress === "0xaffF27468fd68C115F0ccC0e790adD0087C1c01b") {
    //     console.log("asw belio");
    //     return null;
    // }

    if (blockList.includes(targetAddress)) {
        console.log("bosok");
    }

    if (
        // targetAddress !== "0xafff27468fd68c115f0ccc0e790add0087c1c01b" &&
        await isBuying(weiBuyerBalance, targetAddress, isBuy) &&
        tp >= "0.1"
        // && await checkHolderTop(buyerAddress)
    ) {
        let qty = 1;

        if (buyerBalance >= '0.3') qty = 2;

        const buyPrice = await friendTech.getBuyPriceAfterFee(buyerAddress, qty)
        const bp = await weiToEth(buyPrice);

        const userDetail = await checkUser(targetAddress);
        const { twitterUsername, address, twitterUserId, holderCount, shareSupply } = userDetail || {};

        console.log(`Target Address ${targetAddress} Balance (${targetBalance} ETH) Buy Price (${tp}) - Buyer Address ${buyerAddress} Balance (${buyerBalance} ETH) - Buying(${isBuy}) --- Buy Price (${bo})`);

        if (twitterUserId && bp <= '0.01' && !alreadyBought.includes(buyerAddress)) {
            let twitterResponse = await rwClient.v1.user({
                user_id: twitterUserId
            });
            const { created_at, followers_count, verified, statuses_count } = twitterResponse || {};
            if (followers_count >= 100 && statuses_count > 100) {
                const tx = await friendTech.buyShares(buyerAddress, qty, { value: buyPrice, gasPrice })

                alreadyBought.push(buyerAddress);
                try {
                    const alreadyBoughtJson = JSON.stringify(alreadyBought);
                    fs.writeFileSync('./buysFT.txt', alreadyBoughtJson, 'utf8');
                } catch (error) {
                    console.error('Error writing to the "buys" file:', error);
                }

                try {
                    const receipt = await tx.wait();
                    console.log('Transaction Mined:', receipt.blockNumber);
                } catch (error) {
                    console.log('Transaction Failed:', error);
                }
            }
        }

    }

}

const run = async () => {
    let filter = friendTech.filters.Trade(null, null, null, null, null, null, null, null);

    friendTech.on(filter, async (event) => {
        await processTradeEvent(event);
    });
};

try {
    run();
} catch (error) {
    console.error('ERR:', error);
}

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
});
