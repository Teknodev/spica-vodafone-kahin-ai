import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as User from "../../63b6a403ebfd83002c5e104e/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";

import fetch from 'node-fetch';

const PAST_MATCHES_BUCKET = Environment.env.PAST_MATCHES;
const CHARGE_LOGS_BUCKET = Environment.env.CHARGE_LOGS;

const CHARGE_AMOUNT = "5.99";
const CHARGE_PRODUCT = "261063";

export async function onInsertedMatch(changed) {
    const document = changed.document;
    const usersIds = [document.user1]

    if (document.duel_type == 0) {
        usersIds.push(document.user2)
    }

    const usersData = await getMsisdnsByUsersIds(usersIds);

    let isSuccess = true;
    for (const [index, userData] of usersData.entries()) {
        const bodyData = {
            "submitTime": Date.now(),
            "msisdn": userData.msisdn.substring(2),
            "action": "4islem_played",
            "chargedAmount": "",
            "chargedProduct": ""
        }
        // const response = await sendMarketingServiceData(bodyData);
        // if (!response || response.body != 'Success') {
        //     isSuccess = false;
        // }
    }

    if (isSuccess) {
        Api.updateOne(PAST_MATCHES_BUCKET, {
            _id: Api.toObjectId(document._id)
        }, {
            $set: { is_success: true }
        })
    }
}

export async function onChargeUpdated(changed) {
    const document = changed.document;
    const keys = Object.keys(changed.updateDescription.updatedFields);

    if (!document.status || !document.item_id || !keys || !keys.includes('status')) {
        return;
    }

    const bodyData = {
        "submitTime": Date.now(),
        "msisdn": document.msisdn.substr(2),
        "action": "4islem_charged",
        "chargedAmount": CHARGE_AMOUNT,
        "chargedProduct": CHARGE_PRODUCT
    }

    // const response = await sendMarketingServiceData(bodyData);
    // if (!response || response.body != 'Success') {
    //     isSuccess = false;
    // }

    if (isSuccess) {
        const Bucket = Api.useBucket();
        Bucket.data.patch(CHARGE_LOGS_BUCKET, String(document._id), { is_success: true }).catch(console.error)
    }
}

async function getMsisdnsByUsersIds(usersIds) {
    const usersData = [];
    const db = await Api.useDatabase();
    const identityCollection = db.collection(`identity`);

    for (const userId of usersIds) {
        const _user = await User.getOne({ _id: Api.toObjectId(userId) });
        if (_user) {
            const identityData = await identityCollection.findOne({ _id: Api.toObjectId(_user.identity) });
            if (identityData) {
                usersData.push({
                    user_id: userId,
                    msisdn: identityData.attributes.msisdn
                })
            }
        }
    }

    return usersData;
}

async function sendMarketingServiceData(bodyData) {
    let response;
    try {
        await fetch("https://marketingservices.turkcell.com.tr/marketingServices/rest/GenericKafka/produce?topic=poly", {
            method: "post",
            body: JSON.stringify({
                ...bodyData
            }),
            headers: { "Content-Type": "application/json" }
        })
            .then(resTcell => resTcell.json())
            .then(data => { response = data })
    } catch (err) {
        console.log("ERROR : ", err)
        response = err
    }

    return response;
}

export async function sendManuallyData(req, res) {
    // const data = {
    //     submitTime: Date.now(),
    //     msisdn: '5317828001',
    //     action: '4islem_charged',
    //     chargedAmount: '5,99',
    //     chargedProduct: '261063'
    // }

    const data = {
        submitTime: Date.now(),
        msisdn: '5317828001',
        action: '4islem_played',
        chargedAmount: '',
        chargedProduct: ''
    }

    console.log("data", data)
    const response = await sendMarketingServiceData(data);
    console.log("response", response)

    return res.status(200).send({ message: 'Ok' })
}