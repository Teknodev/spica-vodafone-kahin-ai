import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

import * as fs from "fs";
import psList from 'ps-list';
import * as cp from "child_process";

const PROCESS_BUCKET = VARIABLE.BUCKET.PROCESS;

export async function systemReady() {
    installPs();
}

export function installPs() {
    const script = `
    apt-get install telnet -y
    apt-get install procps -y
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
}



export async function clearPs() {
    try {
        const Bucket = Api.useBucket();
        const processes = await Bucket.data.getAll(PROCESS_BUCKET, {
            queryParams: {
                skip: 2,
                sort: {
                    _id: -1
                }
            }
        }).catch(console.error);

        for (const ps of processes) {
            console.log("kill ps: ", ps)
            cp.spawn('kill', ['-9', ps.pid]);
            Bucket.data.remove(PROCESS_BUCKET, ps._id)
        }

    } catch (error) {
        console.error(error);
    }
}

export async function listPs() {
    console.log(await psList());
    return "ok"
}