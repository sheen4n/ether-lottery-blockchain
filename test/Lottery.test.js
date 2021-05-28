const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganache.provider());

const { interface, bytecode } = require('../compile');

let accounts;
let lottery;

beforeEach(async () => {
  // Get a list of all accounts
  accounts = await web3.eth.getAccounts();

  // use one of those accounts to deploy the contract
  lottery = await new web3.eth.Contract(JSON.parse(interface))
    .deploy({ data: bytecode })
    .send({ from: accounts[0], gas: '1000000' });
});

describe('Lottery Contract', () => {
  it('deploys a contract', () => {
    assert.ok(lottery.options.address);
  });

  it('has a default manager', async () => {
    const manager = await lottery.methods.manager().call();
    assert.strictEqual(manager, accounts[0]);
  });

  it('allows one account to enter', async () => {
    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei('0.011', 'ether'),
    });

    const players = await lottery.methods.getPlayers().call({
      from: accounts[0],
    });

    assert.strictEqual(players[0], accounts[0]);
    assert.strictEqual(players.length, 1);
  });

  it('allows multiple account to enter', async () => {
    await Promise.all(
      accounts.map(async (account) => {
        await lottery.methods.enter().send({
          from: account,
          value: web3.utils.toWei('0.011', 'ether'),
        });
      }),
    );

    const players = await lottery.methods.getPlayers().call({
      from: accounts[0],
    });

    accounts.map((account, i) => {
      assert.strictEqual(players[i], account);
    });

    assert.strictEqual(players.length, accounts.length);
  });

  it('requires a minimum amount of ether to enter', async () => {
    try {
      await lottery.methods.enter().send({
        from: accounts[0],
        value: web3.utils.toWei('0.01', 'ether'),
      });
      assert(false);
    } catch (error) {
      assert.ok(error);
    }
  });

  it('requires the manager to call pickWinner', async () => {
    try {
      await lottery.methods.pickWinner().send({
        from: accounts[1],
      });
      assert(false);
    } catch (error) {
      assert.ok(error);
    }
  });

  it('sends money to the winner and resets the players array', async () => {
    await lottery.methods.enter().send({
      from: accounts[1],
      value: web3.utils.toWei('2', 'ether'),
    });

    const initialBalance = await web3.eth.getBalance(accounts[1]);

    await lottery.methods.pickWinner().send({
      from: accounts[0],
    });

    const finalBalance = await web3.eth.getBalance(accounts[1]);

    const difference = finalBalance - initialBalance;

    // Asserts that player has been paid
    assert(difference > web3.utils.toWei('1.8', 'ether'));

    const players = await lottery.methods.getPlayers().call({
      from: accounts[0],
    });

    // Clears players list
    assert.strictEqual(players.length, 0);

    // Clears the contract value
    assert.strictEqual(await web3.eth.getBalance(lottery.options.address), '0');
  });
});
