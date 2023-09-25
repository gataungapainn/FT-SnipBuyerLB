const ethers = require('ethers')

const weiToEth = async (value) => {
    return await ethers.formatEther(value)
}

const ethToWei = async (value) => {
    return await ethers.parseUnits(value, "ether");
}

module.exports = { weiToEth, ethToWei };