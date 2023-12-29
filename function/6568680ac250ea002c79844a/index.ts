import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

import psList from 'ps-list';

const REWARD_BUCKET = VARIABLE.BUCKET.REWARD;
const REWARD_QUEUE_BUCKET = VARIABLE.BUCKET.REWARD_QUEUE;
const TELNET_REQ_RES_BUCKET = VARIABLE.BUCKET.TELNET_REQ_RES;

let terminal;
const REASON_CODE = 16549;
const HOST = 'mma.vodafone.com.tr';
const PORT = 2144;
// const msisdn = "5367022769";

export async function setReward() {
    console.log("@setReward")

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
                txn_id: reward.txn_id
            })

            sendMessage(`{ echo "dload ${reward.txn_id} ${REASON_CODE} ${reward.msisdn} 3:5:3221225472"; sleep 1; } | telnet ${HOST} ${PORT} \n`)
            // `{ echo "dload ${reward.txn_id} ${REASON_CODE} ${reward.msisdn} 3:5:3221225472"; sleep 1; } | telnet ${HOST} ${PORT} \n`
            // `{ echo "info ${reward.msisdn}"; sleep 1; } | telnet ${HOST} ${PORT} \n`
        }

    } catch (err) {
        console.log("err: ", err)
    }
}

export async function createChildProcess() {
    console.log("@createChildProcess")

    terminal = require('child_process').spawn('bash');

    terminal.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
        handleTelnetRes(data.toString())
    });

    terminal.on('exit', function (code) {
        console.log('child process exited with code ' + code);
    });
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
    console.log("@handleDload", message);

    const parsed = parseInput(message)
    const userText = parsed[2];
    const date = new Date(convertToDate(parsed[3]))
    const txnId = parsed[4];

    updateRewardLogByTxnId(txnId, {
        user_text: userText,
        date,
        status: resCode == RESULT_CODE.SUCCESS
    })

    removeRewardQueueByTxnId(txnId)
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

async function removeRewardQueueByTxnId(txnId) {
    const Bucket = Api.useBucket();
    const [reward] = await Bucket.data.getAll(REWARD_QUEUE_BUCKET, { queryParams: { filter: { txn_id: txnId } } }).catch(console.error);
    if (!reward) return;
    return Bucket.data.remove(REWARD_QUEUE_BUCKET, reward._id).catch(console.error);
}

async function updateRewardLogByTxnId(txnId, data) {
    const Bucket = Api.useBucket();
    const [reward] = await Bucket.data.getAll(REWARD_BUCKET, { queryParams: { filter: { txn_id: txnId } } }).catch(console.error);
    if (!reward) return;
    return Bucket.data.patch(REWARD_BUCKET, reward._id, data).catch(console.error);
}

const TXN_NO = {
    INFO: "info",
    DLOAD: "dload"
}

const RESULT_CODE = {
    "SUCCESS": 0,
}

function parseInput(input) {
    const regex = /(\w+)\s+(\d+)\s+{?([^}]*)}? (\d{8}) (\d+)/;
    const match = input.match(regex);

    return match ? [match[1], match[2], match[3], match[4], match[5]] : null;
}

function convertToDate(inputDate) {
    return `${inputDate.slice(0, 4)}-${inputDate.slice(4, 6)}-${inputDate.slice(6, 8)}`;
}

export async function testProcessPid() {
    // terminal = require('child_process').spawn('bash');

    // console.log('Terminal PID:', terminal.pid);

    // terminal.on('exit', (code, signal) => {
    //     console.log(`Terminal process exited with code ${code} and signal ${signal}`);
    // });

    // setTimeout(() => {
    //      terminal.stdin.end();
    // }, 1000)

    try {
        console.log(await psList());

    } catch (error) {
        console.error('Error listing terminals:', error);
    }

    return "ok"
}


export async function installPs() {
    const script = `
            sudo apt-get install procps
        `;

    const scriptPath = "/tmp/sendtelnetmessage.sh";
    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, "755");
    const output = cp.spawnSync(scriptPath, [], {
        env: {},
        stdio: ["ignore", "inherit", "inherit"]
    });

    console.log(output)

    console.log("finished");

    return "ok"
}
