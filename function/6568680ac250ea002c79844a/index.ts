import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as User from "../../63b6a403ebfd83002c5e104e/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const REWARD_BUCKET = VARIABLE.BUCKET.REWARD;
const REWARD_QUEUE_BUCKET = VARIABLE.BUCKET.REWARD_QUEUE;
const TELNET_REQ_RES_BUCKET = VARIABLE.BUCKET.TELNET_REQ_RES;
const PROCESS_BUCKET = VARIABLE.BUCKET.PROCESS;

let terminal;
const REASON_CODE = 16549;
const HOST = 'mma.vodafone.com.tr';
const PORT = 2144;
// const msisdn = "5367022769";

let lastTxnDate, lastTxnId;
export async function setReward() {
    if (lastTxnDate && terminal && lastTxnId) {
        console.log("lastTxnId: ", lastTxnId)
        terminal.stdin.end();
        terminal = undefined;
        await updateRewardQueueByTxnId(lastTxnId);
        lastTxnDate = undefined;
    }

    try {
        if (!terminal) {
            createChildProcess();
        }

        // console.log("LOG 2")

        const Bucket = Api.useBucket();
        const [reward] = await Bucket.data.getAll(REWARD_QUEUE_BUCKET, {
            queryParams: {
                filter: {
                    next_try_date: {
                        $lte: `Date("${new Date()}")`
                    }
                }
            }
        });

        if (reward) {
            await insertRewardLog({
                msisdn: reward.msisdn,
                date: new Date(),
                txn_id: reward.txn_id,
                purpose: reward.purpose
            })

            lastTxnDate = new Date();
            lastTxnId = reward.txn_id;
            sendMessage(`{ echo "dload ${reward.txn_id} ${REASON_CODE} ${reward.msisdn} 3:5:3221225472"; sleep 1; } | telnet ${HOST} ${PORT} \n`)
            // sendMessage(`{ echo "info ${reward.msisdn}"; sleep 1; } | telnet ${HOST} ${PORT} \n`)
        }

    } catch (err) {
        console.log("err: ", err)
    }

}

export async function createChildProcess() {
    terminal = require('child_process').spawn('bash');

    terminal.stdout.on('data', function (data) {
        handleTelnetRes(data.toString())
    });

    terminal.on('exit', function (code) {
        console.log('child process exited with code ' + code);
    });

    insertPid();
}

function sendMessage(message) {
    terminal.stdin.write(message);
    insertTelnetReqRes(message, "req");
}

function handleTelnetRes(message) {
    insertTelnetReqRes(message, "res");

    const handleTxnNo = {
        [TXN_NO.INFO]: (props) => handleInfo(props.message, props.resCode),
        [TXN_NO.DLOAD]: (props) => handleDload(props.message, props.resCode)
    }

    const txnNo = message.split(" ")[0];

    switch (txnNo) {
        case "info":
        case "dload":
            lastTxnDate = undefined;
            const resCode = message.split(" ")[1];
            handleTxnNo[txnNo]({ message, resCode })
            break;
        default:
            break;
    }
}

async function handleInfo(message, resCode) {
    console.log("@handleInfo", message);
}

async function handleDload(message, resCode) {
    console.log("@handleDload", message, resCode);

    const parsed = parseInput(message)
    const userText = parsed[2];
    const date = new Date(convertToDate(parsed[3]))
    const txnId = parsed[4];

    const reward = await getRewardQueueByTxnId(txnId);

    removeRewardQueueByTxnId(txnId)

    if (!reward) return;

    updateRewardLogByTxnId(txnId, {
        user_text: userText,
        // date,
        status: resCode == RESULT_CODE.SUCCESS,
        status_code: Number(resCode),
        purpose: reward.purpose
    })

    switch (resCode) {
        case RESULT_CODE.SYSTEM_ERROR:
            const nextTryDate = new Date();
            Api.insertOne(REWARD_QUEUE_BUCKET, {
                msisdn: reward.msisdn,
                created_at: new Date(),
                next_try_date: new Date(nextTryDate.setMinutes(nextTryDate.getMinutes() + 5)),
                txn_id: String(Date.now()),
                purpose: reward.purpose
            })
            break;
        case RESULT_CODE.SUCCESS:
            updateUserTotalReward(reward.msisdn);
            break;
        default:
            break;
    }
}

function insertTelnetReqRes(message, type) {
    const Bucket = Api.useBucket();
    Bucket.data.insert(TELNET_REQ_RES_BUCKET, {
        message,
        created_at: new Date(),
        type
    });
}

function insertRewardLog(data) {
    const Bucket = Api.useBucket();
    return Bucket.data.insert(REWARD_BUCKET, data).catch(console.error);
}

async function getRewardQueueByTxnId(txnId) {
    const Bucket = Api.useBucket();
    const [reward] = await Bucket.data.getAll(REWARD_QUEUE_BUCKET, { queryParams: { filter: { txn_id: txnId } } }).catch(console.error);
    return reward;
}

async function removeRewardQueueByTxnId(txnId) {
    const reward = await getRewardQueueByTxnId(txnId);
    if (!reward) return;
    const Bucket = Api.useBucket();
    return Bucket.data.remove(REWARD_QUEUE_BUCKET, reward._id).catch(console.error);
}
async function updateRewardQueueByTxnId(txnId) {
    const reward = await getRewardQueueByTxnId(txnId);
    if (!reward) return;

    const tryCount = reward.try_count ? reward.try_count += 1 : 1;

    if (tryCount > 6) {
        await removeRewardQueueByTxnId(txnId)
        return;
    }

    const updateData = {
        last_try_date: new Date(lastTxnDate),
        try_count: tryCount,
        txn_id: String(Date.now()),
        next_try_date: getNextTryDate(tryCount)
    }
    const Bucket = Api.useBucket();
    return Bucket.data.patch(REWARD_QUEUE_BUCKET, reward._id, updateData).catch(console.error);
}

async function updateRewardLogByTxnId(txnId, data) {
    const Bucket = Api.useBucket();
    const [reward] = await Bucket.data.getAll(REWARD_BUCKET, { queryParams: { filter: { txn_id: txnId } } }).catch(console.error);
    if (!reward) return;
    return Bucket.data.patch(REWARD_BUCKET, reward._id, data).catch(console.error);
}

async function updateUserTotalReward(msisdn) {
    if (!msisdn) return;
    const user = await User.getByMsisdn(msisdn);
    if (!user) return;

    const rangeAward = (user.range_award || 0) + 3;
    const totalAward = (user.total_award || 0) + 3

    const update = {
        "$set": {
            range_award: rangeAward,
            total_award: totalAward
        }
    }

    User.updateOne({ _id: user._id }, update).catch(console.error)
}

const TXN_NO = {
    INFO: "info",
    DLOAD: "dload"
}

const RESULT_CODE = {
    "SUCCESS": "0",
    "SYSTEM_ERROR": "3"
}

function parseInput(input) {
    const regex = /(\w+)\s+(\d+)\s+{?([^}]*)}? (\d{8}) (\d+)/;
    const match = input.match(regex);

    return match ? [match[1], match[2], match[3], match[4], match[5]] : null;
}

function convertToDate(inputDate) {
    return `${inputDate.slice(0, 4)}-${inputDate.slice(4, 6)}-${inputDate.slice(6, 8)}`;
}

function insertPid() {
    const pid = terminal.pid;
    if (!pid) return;

    const Bucket = Api.useBucket();
    Bucket.data.insert(PROCESS_BUCKET, { pid, name: 'bash' }).catch(console.error);
}

function getNextTryDate(tryCount) {
    const periodArr = [1, 5, 30, 120, 720, 1440]
    const min = periodArr[tryCount - 1];
    if (!min) return;

    const lastDate = new Date(lastTxnDate);
    return new Date(lastDate.setMinutes(lastDate.getMinutes() + min))
}