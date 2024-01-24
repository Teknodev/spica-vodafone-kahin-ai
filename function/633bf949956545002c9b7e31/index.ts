import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";
import * as Bucket from '@spica-devkit/bucket';
import * as Identity from "@spica-devkit/identity";

// const { Telnet } = require('telnet-client');

const USER_BUCKET = VARIABLE.BUCKET.USER;
const REWARD_BUCKET = VARIABLE.BUCKET.REWARD_LOG;
const SECRET_KEY = VARIABLE.SECRET_API_KEY;
const NOTIFICATION_BUCKET = VARIABLE.BUCKET.NOTIFICATION_LOG;


export async function replaceAbusiveName() {
    const dateNow = new Date();
    let filterDate = new Date(dateNow.setMinutes(dateNow.getMinutes() - 90))
    const wordsArr = await getAbusiveNames();

    const db = await Api.useDatabase();
    const userData = await db
        .collection(`bucket_${USER_BUCKET}`)
        .find({ created_at: { $gte: filterDate }, name: { $in: wordsArr } }).toArray()
        .catch(err => console.log("ERROR 2", err));

    for (const user of userData) {
        console.log(`user_id: ${user._id} - name: ${user.name}`)
        let random = Math.floor(Math.random() * 100000) + 1
        await db
            .collection(`bucket_${USER_BUCKET}`)
            .updateOne({ _id: Api.toObjectId(user._id) }, { $set: { name: `Kullanıcı34${random}` } })
            .catch(err => console.log("ERROR 2", err));
    }
}

export async function insertDataWithId(req, res) {
    const { data } = req.body;
    const db = await Api.useDatabase();
    const collection = db.collection('bucket_605c9480e9960e002c278191');

    // const policies = await collection.find().toArray();
    data.forEach(el => {
        el._id = Api.toObjectId(el._id)
    })

    await collection.insertMany(data).catch(console.error)
    return res.status(200).send({ message: 'ok' })
}

export function differenceBetweenDates(date1, date2) {
    const date1Seconds = Math.floor(new Date(date1).getTime() / 1000);
    const date2Seconds = Math.floor(new Date(date2).getTime() / 1000);
    return date1Seconds - date2Seconds;
}

export function getTokenByReq(req) {
    let token = req.headers.get("authorization")
    if (!token) {
        return
    }
    return token.split(" ")[1];
}

export async function getDecodedToken(token) {
    const Identity = await Api.useIdentity();
    return Identity.verifyToken(token).catch(console.error)
}

export function codeGenerate(length) {
    let result = "";
    let characters = "123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return parseInt(result);
}

async function getAbusiveNames() {
    let response;
    try {
        response = await Api.httpRequest("get", "https://raw.githubusercontent.com/idriska/turkce-kufur-karaliste/master/karaliste.json")
    } catch (err) {
        console.log(err)
    }

    return response.data;
}


export async function getMyIp(req, res) {
    const response = await Api.httpRequest("get", "https://api.ipify.org?format=json").catch(console.error)
    console.log("data", response.data)

    return res.status(200).send({ message: 'ok' })
}

/*

const WebSocket = require('ws');

let socket;
export function createConnection() {
    console.log("ID: 12342346")
    if (!socket) {
        socket = new WebSocket('ws://mma.vodafone.com.tr:2144');
        // socket = new WebSocket('wss://socketsbay.com/wss/v2/1/demo/');
    }

    // Connection event
    socket.on('open', () => {
        console.log('Connected to remote server');
    });

    // Message event
    socket.on('message', (message) => {
        console.log(message);
    });

    // Close event
    socket.on('close', () => {
        console.log('Connection closed');
    });

    socket.on('error', (error) => {
        console.log(error);
    });

    setTimeout(() => {
        console.log("readyState: ", socket.readyState, WebSocket.OPEN);
        // if (socket.readyState === WebSocket.OPEN) {
            console.log("IF")
            socket.send("info 5367022769");
            socket.close();
        // }
    }, 2500)

    return "ok"
}

*/

// function sendMessageToServer() {
//     if (socket.readyState === WebSocket.OPEN) {
//         // Check if the connection is open before sending the message
//         socket.send("dload 633bf949956545002c9b7e31 16549 5367022769 3:5:3221225472");
//     } else {
//         console.log('Connection is not open. Cannot send message.');
//     }
// }

// export async function removeChargeCount() {
//     const db = await Api.useDatabase();
//     await db
//         .collection(`bucket_${USER_BUCKET}`)
//         .updateMany({ bot: true }, { $unset: { weekly_point: '' } })
//         .catch(err => console.log("ERROR 2", err));


//     return "ok"
// }


export function testDateFormat() {
    const date = formatDate("16/01/2024 11:22:48.337");
    console.log(date)
    return "ok"
}

function formatDate(inputDateString) {

    const [day, month, yearTime] = inputDateString.split("/");
    const [year, time] = yearTime.split(" ");
    const [hour, minute, second] = time.split(":");
    const milliseconds = Number(second.split(".")[1]);

    const formattedDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, milliseconds));

    formattedDate.setUTCHours(formattedDate.getUTCHours() - 6);

    const options = {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);

    return new Date(formatter.format(formattedDate));
}

export async function getNonRewardedUsers(req, res) {
    let dateFilter = {
        $gte: new Date("2024-01-17T21:00:00.000Z"),
        $lt: new Date("2024-01-18T03:00:00.000Z")
    };

    const db = await Api.useDatabase();
    const rewardLogscollection = db.collection(`bucket_${REWARD_BUCKET}`);

    const users = await rewardLogscollection.find({
        date: dateFilter,
        $or: [{ status: false }, { status: { $exists: false } }]
    }).toArray().catch("ERROR 100", console.error);
    console.log("users: ", users.length);
    return res.send(users)

}


//----------------------------------------

export async function getUserIdentity() {
    const date = new Date("2024-01-16T08:36:19.460Z")
    Bucket.initialize({ apikey: SECRET_KEY });
    let data = await Bucket.data.getAll(USER_BUCKET, {
        queryParams: {
            filter: {
                identity: { $ne: null },
                created_at: { $lt: `Date("${date}")` }
            }
        }
    });

    const lowDate = Array.from(data, x => x.identity)

    // const lowDate = data.map(el => el.identity)
    console.log("lowdate", lowDate.length)


    return lowDate;
}


export async function getIdentityMsisdn(userIdentities) {

    Identity.initialize({ apikey: SECRET_KEY })

    const matchingArray = []

    for (var i in userIdentities) {
        let idMatch = await Identity.get(userIdentities[i])
        if (idMatch._id !== undefined) {
            matchingArray.push(idMatch);
        }
    }
    const idmsisdn = matchingArray.map(el => ({
        _id: el._id,
        msisdn: el.identifier,
    }));

    return idmsisdn
}

export async function getNotifications(userinfo) {

    const usermsisdn = userinfo.map(el => el.msisdn)

    Bucket.initialize({ apikey: SECRET_KEY });
    let data = await Bucket.data.getAll(NOTIFICATION_BUCKET, {
        queryParams: {
            filter: {
                notification: { $nin: ["AdvanceChargingSuccessful", "SmsSent"] },
                msisdn: { $in: usermsisdn }
            }
        }
    });

    var resultData = data.map(function (bucket) {
        var matchingUser = userinfo.find(function (user) {
            return user.msisdn === bucket.msisdn;
        });

        if (matchingUser) {
            return { identity: matchingUser._id, ...bucket };
        } else {
            return bucket;
        }
    });

    return resultData
}


export async function getLastDate(data) {

    const latestData = {};

    data.forEach(el => {
        const msisdn = el.msisdn;
        const date = new Date(el.created_at);
        if (!latestData[msisdn] || date > latestData[msisdn].created_at) {
            latestData[msisdn] = {
                msisdn: msisdn,
                created_at: date,
                notification: el.notification,
                _id: el._id,
                identity: el.identity,
                body: el.body,

            };
        }
    });

    const latestDataArray = Object.values(latestData);
    return latestDataArray;
}



export async function parseBody(dataset) {

    const dates = []
    dataset.forEach(data => {
        try {
            const parsedBody = JSON.parse(data.body);
            dates.push({
                lastRenewalDate: parsedBody.params.subscription.lastRenewalDate,
                nextRenewalDate: parsedBody.params.subscription.nextRenewalDate,
                startDate: parsedBody.params.subscription.startDate,
                _id: data._id,
                identity: data.identity
            })

        } catch (error) {
            console.log("parse data", data);
            console.error('JSON ayrıştırma hatası:', error);
        }
    });

    const updatedData = dates.map(item => ({
        ...item,
        lastRenewalDate: formatDate(item.lastRenewalDate),
        nextRenewalDate: formatDate(item.nextRenewalDate),
        startDate: formatDate(item.startDate)
    }));

    return updatedData
}


export async function updatedate(changes) {

    const userIdentities = await getUserIdentity();
    const msisdns = await getIdentityMsisdn(userIdentities)
    const notifications = await getNotifications(msisdns);
    const lastDates = await getLastDate(notifications)
    const dates = await parseBody(lastDates)

    // console.log("datesLength",dates.length)
    // return dates

    Bucket.initialize({ apikey: SECRET_KEY });

    // const testData = [dates[0]]


    for (const data of dates) {
        let patchedFields = {
            subscription_last_renewal_date: new Date(data.lastRenewalDate),
            subscription_next_renewal_date: new Date(data.nextRenewalDate),
            subscription_start_date: new Date(data.startDate)
        };

        const [user] = await Bucket.data.getAll(USER_BUCKET, { queryParams: { filter: { identity: data.identity } } })
        if (user) {
            await Bucket.data.patch(USER_BUCKET, user._id, patchedFields).catch(console.error)
        }
    }

    return dates
}


//---------------------------------------------------------

export async function getSubscriptionNone() {
    const date = new Date("2024-01-11T08:36:19.460Z")
    Bucket.initialize({ apikey: SECRET_KEY })
    let subs = await Bucket.data.getAll(USER_BUCKET, {
        queryParams: {
            filter: { subscription_status: { $exists: false }, bot: false },
            created_at: { $ht: `Date("${date}")` },
            limit: 3
        }
    })
    const identities = Array.from(subs, x => x.identity)
    // console.log("test", identities)
    // const subsidentity= subs.map(el => el.identity)
    return identities
}
export async function getSubscriptionMsisdn(userIdentities) {

    Identity.initialize({ apikey: SECRET_KEY })

    const matchingArray = []

    for (var i in userIdentities) {
        let idMatch = await Identity.get(userIdentities[i])
        if (idMatch._id !== undefined) {
            matchingArray.push(idMatch);
        }
    }
    const idmsisdn = matchingArray.map(el => ({
        _id: el._id,
        msisdn: el.identifier,
    }));
    // console.log("test",idmsisdn)
    return idmsisdn
}

export async function notificationsMatch(identityMsisdn) {
    const usermsisdn = Array.from(identityMsisdn, x => x.msisdn)
    // console.log("testmsisdn", usermsisdn)
    Bucket.initialize({ apikey: SECRET_KEY });
    let data = await Bucket.data.getAll(NOTIFICATION_BUCKET, {
        queryParams: {
            filter: {
                notification: { $in: ["SubscriptionCreated", "SubscriptionDeactivated", "SubscriptionSuspended", "CreateSubscriptionFailed", "SubscriptionResumed"] },
                msisdn: { $in: usermsisdn },
                limit: 5
            }
        }
    });

    var resultData = data.map(function (bucket) {
        var matchingUser = identityMsisdn.find(function (user) {
            return user.msisdn === bucket.msisdn;
        });

        if (matchingUser) {
            return { identity: matchingUser._id, ...bucket };
        } else {
            return bucket;
        }
    });

    const latestData = {};

    resultData.forEach(el => {
        const msisdn = el.msisdn;
        const date = new Date(el.created_at);
        if (!latestData[msisdn] || date > latestData[msisdn].created_at) {
            latestData[msisdn] = {
                msisdn: msisdn,
                created_at: date,
                notification: el.notification,
                _id: el._id,
                identity: el.identity,

            };
        }
    });
    const latestDataArray = Object.values(latestData);
    // const notifications = Array.from(data, x => x.notification)
    // console.log("testNoti", latestDataArray)
    return latestDataArray
}

export async function defineStatus(notifications) {

    const NOTIFICATION = {
        SUBSCRIPTION_CREATED: "SubscriptionCreated",
        CREATE_SUBSCRIPTION_FAILED: "CreateSubscriptionFailed",
        SUBSCRIPTION_SUSPENDED: "SubscriptionSuspended",
        SUBSCRIPTION_RESUMED: "SubscriptionResumed",
        SUBSCRIPTION_RENEWED: "SubscriptionRenewed",
        SUBSCRIPTION_WILL_BE_DEACTIVATED: "SubscriptionWillBeDeactivated",
        SUBSCRIPTION_DEACTIVATED: "SubscriptionDeactivated",
        SUBSCRIPTION_DEACTIVATION_FAILED: "SubscriptionDeactivationFailed",
        ADVANCE_CHARGING_SUCCESSFUL: "AdvanceChargingSuccessful"
    }

    // const SUBSCRIPTION_NOTIFICATIONS = [
    //   NOTIFICATION.SUBSCRIPTION_CREATED,
    //   NOTIFICATION.CREATE_SUBSCRIPTION_FAILED,
    //   NOTIFICATION.SUBSCRIPTION_SUSPENDED,
    //   NOTIFICATION.SUBSCRIPTION_RESUMED,
    //   NOTIFICATION.SUBSCRIPTION_RENEWED,
    //   NOTIFICATION.SUBSCRIPTION_WILL_BE_DEACTIVATED,
    //   NOTIFICATION.SUBSCRIPTION_DEACTIVATED,
    //   NOTIFICATION.SUBSCRIPTION_DEACTIVATION_FAILED,
    //   NOTIFICATION.ADVANCE_CHARGING_SUCCESSFUL,
    // ]

    const batu = {
        [NOTIFICATION.SUBSCRIPTION_CREATED]: "active",
        [NOTIFICATION.SUBSCRIPTION_SUSPENDED]: "suspended",
        [NOTIFICATION.SUBSCRIPTION_DEACTIVATED]: "deactiveted",
        [NOTIFICATION.SUBSCRIPTION_RESUMED]: "active",
        [NOTIFICATION.CREATE_SUBSCRIPTION_FAILED]: "inactive",

    }
    var statusDefined = [];
    // console.log("data", notifications)
    notifications.forEach(el => {
        statusDefined.push({
            _id: el._id,
            identity: el.identity,
            created_at: el.created_at,
            msisdn: el.msisdn,
            notification: el.notification,
            subscription_status: batu[el.notification]
        });
    })
    // const latestDataArray = Object.values(test);
    // console.log("testtest", statusDefined)
    return statusDefined
}

export async function patchUserStatus() {

    const userIdentities = await getSubscriptionNone();
    const idmsisdn = await getSubscriptionMsisdn(userIdentities)
    const latestDataArray = await notificationsMatch(idmsisdn);
    const statusDefined = await defineStatus(latestDataArray)

    console.log("last", statusDefined)
    return statusDefined
    // Bucket.initialize({ apikey: SECRET_KEY });


    // for (const data of statusDefined) {
    //   let patchedFields = {
    //     subscription_status: data.subscription_status
    //   };

    //   const [user] = await Bucket.data.getAll(USER_BUCKET, { queryParams: { filter: { identity: data.identity } } })
    //   if (user) {
    //     await Bucket.data.patch(USER_BUCKET, user._id, patchedFields).catch(console.error)
    //   }
    // }


}

//--------------------------------------------------

// export async function revision() {

//     Bucket.initialize({ apikey: SECRET_KEY });
//     const data = await Bucket.data.getAll(NOTIFICATION_BUCKET, {
//         queryParams: {
//             filter: {
//                 notification: { $in: ["SubscriptionCreated"] },
//             }
//         }
//     });


//     var statusDefined = [];
//     // console.log("data", notifications)
//     data.forEach(el => {
//         statusDefined.push({
//             msisdn: el.msisdn,
//             created_at: el.created_at,
//         });
//     })

//         //     } catch (error) {
//         //       console.log("parse data", data);
//         //       console.error('JSON ayrıştırma hatası:', error);
//         //     }
//         //   });

//         //   console.log("refunded", latestDataArray);

//     return statusDefined
// }