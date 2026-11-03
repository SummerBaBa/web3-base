// 合约测试：使用 Node.js 内置的 node:test + node:assert。
// Hardhat 3 通过 hardhat-node-test-runner 插件把两者集成起来，
// 执行 `npm test` 即可在一条临时链上部署并测试合约。

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("ChainLab", () => {
  // 这些变量在 before 中初始化，供所有用例共享。
  let ethers;
  let contract;
  let alice;
  let bob;

  // before 只执行一次：创建网络连接、部署一份全新的合约。
  // 注意：同一个 describe 里的用例共享这份合约状态，
  // 因此后面的用例会看到前面用例写入的留言。
  before(async () => {
    ({ ethers } = await network.create());

    // 取两个测试账户，用来验证 msg.sender / author 是否正确。
    [alice, bob] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("ChainLab");
    contract = await factory.deploy();
    await contract.waitForDeployment();
  });

  it("初始状态下没有留言", async () => {
    // Solidity 的 uint256 在 ethers v6 里会以 BigInt 返回，
    // 所以这里用 0n 而不是 0 进行比较。
    assert.equal(await contract.noteCount(), 0n);
  });

  it("可以写入留言并记录作者与内容", async () => {
    // 写操作会发送一笔交易，必须等待上链后才能读取最新状态。
    const tx = await contract.connect(alice).createNote("hello web3");
    const receipt = await tx.wait();

    assert.equal(await contract.noteCount(), 1n);

    // 验证链上存储的字段：id、作者、内容、时间戳。
    const note = await contract.getNote(0);
    assert.equal(note.id, 0n);
    assert.equal(note.author, alice.address);
    assert.equal(note.content, "hello web3");
    assert.ok(note.createdAt > 0n);

    // 验证事件：只查询刚被打包的那个区块，避免拿到其他测试的数据。
    const events = await contract.queryFilter(
      contract.filters.NoteCreated(),
      receipt.blockNumber,
      receipt.blockNumber,
    );

    assert.equal(events.length, 1);
    assert.equal(events[0].args.author, alice.address);
    assert.equal(events[0].args.content, "hello web3");
  });

  it("拒绝空内容", async () => {
    // 合约使用自定义 error，ethers 会把回滚原因包装进异常信息里。
    // assert.rejects 用来断言这个 Promise 一定会失败。
    await assert.rejects(
      contract.connect(alice).createNote(""),
      /EmptyContent/,
    );
  });

  it("拒绝超过 280 字节的内容", async () => {
    // 这里故意构造 281 个 ASCII 字符（每个占 1 字节）。
    const tooLong = "a".repeat(281);

    await assert.rejects(
      contract.connect(alice).createNote(tooLong),
      /ContentTooLong/,
    );
  });

  it("getRecentNotes 返回最新的留言且顺序正确", async () => {
    // 前面已经写入了一条 "hello web3"（id=0），
    // 这里再按顺序写入 first、second、third（id=1、2、3）。
    await (await contract.connect(alice).createNote("first")).wait();
    await (await contract.connect(bob).createNote("second")).wait();
    await (await contract.connect(alice).createNote("third")).wait();

    // offset=0, limit=2：从最新一条往回跳过 0 条，最多取 2 条。
    // 当前总共有 4 条，因此结果是 id=2、3，即 ["second", "third"]。
    const recent = await contract.getRecentNotes(0, 2);
    assert.deepEqual(
      recent.map((note) => note.content),
      ["second", "third"],
    );

    // offset=1：先跳过最新的 "third"，再从剩下的里取最后 2 条。
    // 结果是 id=1、2，即 ["first", "second"]。
    const offset = await contract.getRecentNotes(1, 2);
    assert.deepEqual(
      offset.map((note) => note.content),
      ["first", "second"],
    );

    // offset 超出总数时应返回空数组，而不是报错。
    const empty = await contract.getRecentNotes(999, 10);
    assert.equal(empty.length, 0);
  });
});
