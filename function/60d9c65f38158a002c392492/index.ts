import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";

const USER_POLICY = Environment.env.USER_POLICY;
const USER_BUCKET = Environment.env.BUCKET.USER;

export async function register(req, res) {
    console.log("@observer::register");
    let { mobile_number, name, avatar_id } = req.body;

    // mobile_number = '5354513344';

    await createIdentity(mobile_number, createPassword(mobile_number))
        .then(async dataIdentity => {
            await addToUserBucket(dataIdentity.identity_id, name, avatar_id)
                .then(data => {
                    return res
                        .status(200)
                        .send({ message: "User registered successfully!", data: data });
                })
                .catch(error => {
                    return res.status(400).send({
                        message: "User added to identity. Error while adding User bucket",
                        error: error
                    });
                });
        })
        .catch(error => {
            return res.status(400).send({
                message: "Error while adding new Identity.",
                error: error
            });
        });
}

export async function login(req, res) {
    console.log("@observer::login");
    let { mobile_number } = req.body;
    // mobile_number = '5354513344';

    await getIdentityToken(mobile_number, createPassword(mobile_number))
        .then(data => {
            return res.status(200).send(data);
        })
        .catch(error => {
            return res.status(400).send(error);
        });
}

async function getIdentityToken(mobile_number, password) {
    const Identity = Api.useIdentity();

    return new Promise(async (resolve, reject) => {
        await Identity.login(mobile_number, password)
            .then(data => {
                resolve({ token: data });
            })
            .catch(error => {
                console.log("--ERROR WHILE GETTING TOKEN");
                reject({ error: error });
            });
    });
}

// -identity operation
async function createIdentity(mobile_number, password) {
    const Identity = Api.useIdentity();

    let msisdn = msisdnGenerate(10);
    // msisdn = '5354513344';

    return new Promise(async (resolve, reject) => {
        await Identity.insert({
            identifier: mobile_number,
            password: password,
            policies: [`${USER_POLICY}`],
            // attributes: {}
            attributes: { msisdn: msisdn }
        })
            .then(identity => {
                resolve({ identity_id: identity._id, msisdn: msisdn });
            })
            .catch(error => {
                console.log("--ERROR WHILE CREATING IDENTITY: ", error);
                reject({ error: error });
            });
    });
}

function msisdnGenerate(length) {
    let result = "";
    let characters = "0123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

async function addToUserBucket(identity_id, name, avatar_id) {
    const Bucket = Api.useBucket();

    return new Promise(async (resolve, reject) => {
        await Bucket.data
            .insert(`${USER_BUCKET}`, {
                identity: identity_id,
                name: name,
                avatar_id: avatar_id,
                total_point: 0,
                weekly_point: 0,
                win_count: 0,
                lose_count: 0,
                total_award: 0,
                weekly_award: 0
            })
            .then(data => {
                resolve(data);
            })
            .catch(error => {
                console.log("--ERROR WHILE ADDING USER BUCKET: ", error);
                reject(error);
            });
    });
}

function createPassword(text) {
    let password = "a-" + text + "-a";
    return password;
}