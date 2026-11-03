// SPDX-License-Identifier: MIT
// SPDX 许可证标识：告诉编译器和工具这个合约使用 MIT 协议开源。
pragma solidity ^0.8.28;
// 指定 Solidity 编译器版本。^0.8.28 表示允许 0.8.28 及以上、0.9.0 以下的版本。
// 0.8.x 内置了整数溢出检查，不需要再引入 SafeMath。

/// @title ChainLab
/// @author ChainLab
/// @notice 一个极简的链上留言板：每条留言都会被永久写入区块链，
///         并通过 NoteCreated 事件对外广播，供链下索引器同步。
/// @dev 这个合约刻意保持简单，目的是展示 Web3 最核心的几件事：
///      1. 状态写入（storage）需要发交易、付 gas；
///      2. 读取（view）不改变链上状态，可以直接调用；
///      3. 事件（event）是链上写给链下世界的“通知”，索引器靠它同步数据。
contract ChainLab {
    /// @notice 一条留言的完整数据结构。
    /// @dev Solidity 的 struct 会按字段顺序打包存储。
    ///      id 用 uint256、时间戳用 uint64，是在“够用”和“省 gas”之间做的取舍。
    struct Note {
        uint256 id; // 留言编号，从 0 开始自增
        address author; // 留言者地址，由 msg.sender 自动记录，无法伪造
        string content; // 留言正文（UTF-8 字符串）
        uint64 createdAt; // 上链时间戳（秒），来自 block.timestamp
    }

    /// @notice 单条留言允许的最大字节数。
    /// @dev 注意这里是“字节”不是“字符”：一个中文字通常占 3 个字节。
    ///      constant 常量在编译期确定，读取它不消耗存储 gas。
    uint256 public constant MAX_CONTENT_LENGTH = 280;

    /// @dev 所有留言按写入顺序保存在动态数组里。
    ///      private 只限制 Solidity 层面的直接访问，链上数据本身仍然是公开可读的；
    ///      外部读取请使用下面的 getNote / getRecentNotes。
    Note[] private notes;

    /// @notice 每当有新留言写入时触发。
    /// @dev indexed 关键字会让该参数进入日志的 topics，链下可以按它高效过滤。
    ///      一条日志最多有 3 个 indexed 参数；这里用了 id 和 author。
    ///      content 和 createdAt 不索引，作为 data 存储，读取成本更低。
    event NoteCreated(
        uint256 indexed id,
        address indexed author,
        string content,
        uint64 createdAt
    );

    /// @notice 留言内容为空时回滚。
    /// @dev 自定义 error 比 require("...") 更省 gas，也更方便前端识别错误类型。
    error EmptyContent();

    /// @notice 留言内容超长时回滚。
    /// @param length 实际字节数
    /// @param maxLength 允许的最大字节数
    error ContentTooLong(uint256 length, uint256 maxLength);

    /// @notice 写入一条链上留言。
    /// @dev 这是一个会改变链上状态的函数，必须通过交易调用：
    ///      钱包签名 -> 广播 -> 矿工/出块者打包 -> 状态真正写入。
    ///      因此调用方需要支付 gas，并且会拿到一个交易哈希。
    /// @param content 留言内容，UTF-8 编码，最长 280 字节
    /// @return id 新留言的编号
    function createNote(string calldata content) external returns (uint256 id) {
        // calldata 表示参数只读、不复制到内存，比 memory 更省 gas。
        // bytes(content) 可以拿到 UTF-8 编码后的真实字节长度。
        uint256 length = bytes(content).length;

        // 先校验再写入，避免无效数据浪费 gas。
        if (length == 0) revert EmptyContent();
        if (length > MAX_CONTENT_LENGTH) {
            revert ContentTooLong(length, MAX_CONTENT_LENGTH);
        }

        // 新留言的 id 就是当前数组长度（从 0 开始）。
        id = notes.length;

        // msg.sender 是当前调用者的地址；block.timestamp 是当前区块时间。
        // 这两个值都由区块链提供，调用方无法在交易里随意伪造。
        notes.push(
            Note({
                id: id,
                author: msg.sender,
                content: content,
                createdAt: uint64(block.timestamp)
            })
        );

        // 状态写入完成后发出事件。
        // 事件不会改变合约状态，但会被永久记录在交易回执的日志里，
        // 链下索引器正是通过监听这个事件来同步留言的。
        emit NoteCreated(id, msg.sender, content, uint64(block.timestamp));
    }

    /// @notice 返回留言总数。
    /// @dev view 函数只读，不消耗 gas（前提是从链下直接调用，而不是在交易里调用）。
    function noteCount() external view returns (uint256) {
        return notes.length;
    }

    /// @notice 按编号读取单条留言。
    /// @param id 留言编号
    /// @return 对应的 Note 结构体
    function getNote(uint256 id) external view returns (Note memory) {
        // Solidity 没有“数组越界返回 null”这种行为，必须显式校验。
        require(id < notes.length, "ChainLab: note does not exist");

        // memory 表示把数据复制到内存后返回，调用方拿到的是副本。
        return notes[id];
    }

    /// @notice 倒序分页读取留言（最新的在前）。
    /// @dev 举例：总共有 5 条留言（id 0~4）。
    ///      - getRecentNotes(0, 2) => [id 3, id 4]
    ///      - getRecentNotes(1, 2) => [id 2, id 3]
    ///      - getRecentNotes(5, 2) => []
    ///      offset 表示“从最新一条往回跳过多少条”，limit 表示“最多取多少条”。
    /// @param offset 跳过最新的多少条
    /// @param limit 最多返回多少条
    /// @return result 按时间正序排列的留言数组（数组内部仍是旧 -> 新）
    function getRecentNotes(
        uint256 offset,
        uint256 limit
    ) external view returns (Note[] memory result) {
        uint256 total = notes.length;

        // 越界或 limit 为 0 时直接返回空数组，避免下面的减法下溢。
        if (offset >= total || limit == 0) {
            return new Note[](0);
        }

        // end 是“不包含”的结束下标：total - offset。
        // start 是起始下标：如果剩余数量大于 limit，就只取最后 limit 条。
        uint256 end = total - offset;
        uint256 start = end > limit ? end - limit : 0;

        // 分配结果数组并逐条复制。
        // 这里用 memory 数组，返回值不会被写入链上存储。
        result = new Note[](end - start);
        for (uint256 i = 0; i < result.length; i++) {
            result[i] = notes[start + i];
        }
    }
}
