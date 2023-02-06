import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";
import * as Tcell from "../../63b6d60cebfd83002c5e1966/.build";
import * as Helper from "../../633bf949956545002c9b7e31/.build";

const USER_BUCKET = Environment.env.BUCKET.USER;
const CONFIRMATION_CODE_BUCKET = Environment.env.BUCKET.CONFIRMATION_CODE;
const BUGGED_REWARD_BUCKET = Environment.env.BUCKET.BUGGED_REWARD;
const MANUALLY_REWARD_BUCKET = Environment.env.BUCKET.MANUALLY_REWARD;

const TCELL_USERNAME = Environment.env.TCELL.USERNAME;
const TCELL_PASSWORD = Environment.env.TCELL.PASSWORD;
const MT_VARIANT = Environment.env.TCELL.MT_VARIANT;
const CHARGE_VARIANT = Environment.env.TCELL.CHARGE_VARIANT;
const CHARGE_OFFER_ID = Environment.env.TCELL.CHARGE_OFFER_ID;

const HOURLY_1GB_OFFER_ID = Environment.env.TCELL.HOURLY_CAMPAIGN_ID;
const HOURLY_CAMPAIGN_ID = Environment.env.TCELL.HOURLY_CAMPAIGN_ID;

const DAILY_1GB_OFFER_ID = Environment.env.TCELL.DAILY_1GB_OFFER_ID;
const DAILY_CAMPAIGN_ID = Environment.env.TCELL.DAILY_CAMPAIGN_ID;

const CHARGE_AMOUNT = Environment.env.TCELL.CHARGE_AMOUNT;

export async function addAvailablePlayReq(req, res) {
    const token = Helper.getTokenByReq(req);
    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    const msisdn = decodedToken.attributes.msisdn;
    let code = Helper.codeGenerate(4);

    const codeData = await Api.getOne(CONFIRMATION_CODE_BUCKET, {
        msisdn: msisdn,
        status: false,
        is_expired: false
    })

    if (codeData) {
        code = codeData.code;
    } else {
        await Api.insertOne(CONFIRMATION_CODE_BUCKET, {
            code,
            msisdn: msisdn,
            status: false,
            sent_date: new Date(),
            is_expired: false
        })
    }

    const smsRes = await sendSmsReq(msisdn, code).catch(err =>
        console.log("ERROR 5", err)
    );

    if (!smsRes) {
        return res
            .status(400)
            .send({ message: "Mesaj gönderilirken bir hata oluştu, daha sonra dene" });
    }

    return res.status(200).send({ message: "Mesaj göderildi" });
}

export async function sendSmsReq(msisdn, code) {
    const message = `Sifreniz: ${code}. Kodu ekrana girerek vergiler dahil ${CHARGE_AMOUNT} karsiliginda GNC 4 Islem Bol GB oyunundan Gunluk 1 GB kazanacaksiniz. Oyunu kazanirsaniz ek olarak Gunluk 1 GB daha kazanacaksiniz. Basarilar!`;
    const shortNumber = 3757;

    const sessionId = await Tcell.getSessionId(TCELL_USERNAME, TCELL_PASSWORD, MT_VARIANT);
    if (!sessionId) {
        return;
    }

    let sendSmsRes = undefined;
    try {
        sendSmsRes = await Tcell.sendSms(sessionId, shortNumber, msisdn, message);
    } catch (err) {
        console.log("AWARD ERR: ", err)
        return;
    }

    const handleRes = await Tcell.handleSendSmsResData(sendSmsRes.data);
    updateConfirmationCode(handleRes.smsOutput, msisdn, code);

    if (handleRes.statusCode == 0) {
        return true
    }

    return;
}

async function updateConfirmationCode(smsOutput, msisdn, code) {
    await Api.updateOne(CONFIRMATION_CODE_BUCKET, { msisdn, code }, {
        $set: { result: JSON.stringify(smsOutput), result_date: new Date() }
    })
}

export async function checkSMSCode(req, res) {
    const { shortCode } = req.body;

    const token = Helper.getTokenByReq(req);
    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    const msisdn = decodedToken.attributes.msisdn;
    const confirmCodeData = await Api.getOne(CONFIRMATION_CODE_BUCKET, {
        msisdn: String(msisdn),
        code: Number(shortCode),
        status: false,
        is_expired: false
    })

    if (!confirmCodeData) {
        return res.status(400).send({ status: false, message: "Yanlış kod girdin" });
    }

    await Api.updateOne(CONFIRMATION_CODE_BUCKET, {
        _id: Api.toObjectId(code._id)
    }, {
        $set: { status: true, confirmed_date: new Date() }
    })

    const chargeRes = await charge(msisdn);
    if (!chargeRes.status) {
        return res.status(400).send({ status: false, message: chargeRes.message });
    }

    const sessionId = await Tcell.getSessionId(TCELL_USERNAME, TCELL_PASSWORD, CHARGE_VARIANT);
    let awardRes = undefined;
    try {
        awardRes = await Tcell.setAward(sessionId, msisdn, DAILY_1GB_OFFER_ID, DAILY_CAMPAIGN_ID);
    } catch (err) {
        console.log("AWARD ERR: ", err)
    }

    if (awardRes) {
        Tcell.handleAwardResData(awardRes.data, '', 'charge');
    }

    const incRes = await increaseAvailablePlay(msisdn);
    if (!incRes) {
        return res.status(200).send({ status: false, message: "Oyun hakkı eklendiğinde bir hata oluştu" });
    }
    return res.status(200).send({ status: true });
}

async function increaseAvailablePlay(msisdn) {
    let identity = undefined;
    try {
        identity = await Api.getIdentityByMsisdn(msisdn)
    } catch (err) {
        return false;
    }

    const user = await Api.getOne(USER_BUCKET, { identity: identity[0]._id })

    const updateRes = await Api.updateOne(USER_BUCKET, { _id: Api.toObjectId(user._id) }, {
        $set: { available_play_count: user.available_play_count + 1 }
    })

    if (!updateRes) {
        return false;
    }

    return true;
}

export async function getWinner(change) {
    const winnerOrder = change.document.winner;
    const user1 = change.document.user1;
    const user2 = change.document.user2;
    let bot_id = "";
    let msisdns = [];
    let winners = [];
    let users = [user1, user2];

    const resUsers = await getUsersData(users).catch(err => console.log("ERROR 14", err));
    msisdns = resUsers.msisdns;
    bot_id = resUsers.bot_id;

    if (winnerOrder == 1) {
        winners = [user1];
    } else if (winnerOrder == 2) {
        if (user2 != bot_id) winners = [user2];
    } else if (winnerOrder == 3) {
        winners = [user1];
        if (user2 != bot_id) winners = [user1, user2];
    }

    if (winners.length == 1) {
        if (users[0] == winners[0]) {
            setAward(msisdns, 0, change.document._id);
        } else {
            setAward(msisdns, 1, change.document._id);
        }
    } else if (winners.length == 2) {
        setAward(msisdns, 0, change.document._id);
        setAward(msisdns, 1, change.document._id);
    }
}

async function setAward(msisdns, winnerIndex, matchId) {
    const sessionId = await Tcell.getSessionId(TCELL_USERNAME, TCELL_PASSWORD, CHARGE_VARIANT);
    if (!sessionId) { return false }

    if (!msisdns[winnerIndex]) { return }

    try {
        awardRes = await Tcell.setAward(sessionId, msisdns[winnerIndex], DAILY_1GB_OFFER_ID, DAILY_CAMPAIGN_ID);
        if (awardRes) {
            Tcell.handleAwardResData(awardRes.data, matchId, 'match');
        }
    } catch (err) {
        console.log("AWARD ERR: ", err)
    }

    return true;
}

async function getUsersData(users) {
    const db = await Api.useDatabase();
    const identityCollection = db.collection(`identity`);

    let bot_id = "";
    let msisdns = [];

    const user1 = await Api.getOne(USER_BUCKET, { _id: Api.toObjectId(users[0]) })
    const user2 = await Api.getOne(USER_BUCKET, { _id: Api.toObjectId(users[1]) })

    const user1Identity = await identityCollection
        .findOne({ _id: Api.toObjectId(user1.identity) })
        .catch(err => console.log("ERROR 25 ", err));

    msisdns.push(user1Identity.attributes.msisdn);

    if (user2.bot == false) {
        const user2Identity = await identityCollection
            .findOne({ _id: Api.toObjectId(user2.identity) })
            .catch(err => console.log("ERROR 26 ", err));

        msisdns.push(user2Identity.attributes.msisdn);
    } else {
        bot_id = user2._id;
    }

    return { msisdns: msisdns, bot_id: bot_id };
}

export async function charge(msisdn) {
    const errRes = {
        status: false,
        message: "Hata oluştu. Ayarlar sayfasından bize ulaşabilirsin"
    };
    const sessionId = await Tcell.getSessionId(TCELL_USERNAME, TCELL_PASSWORD, CHARGE_VARIANT);
    if (!sessionId) {
        return errRes;
    }

    let chargedRes = undefined;
    try {
        chargedRes = await Tcell.charge(sessionId, TCELL_USERNAME, TCELL_USERNAME, msisdn, CHARGE_OFFER_ID)
    } catch (err) {
        console.log("CHARGE ERR: ", err)
        return errRes;
    }

    const handleRes = await Tcell.handleChargeResData(chargedRes.data);
    if (!handleRes) {
        return errRes;
    }

    if (!handleRes.status) {
        return chargeRes;
    }

    return handleRes;
}

export async function applyRewardManually(change) {
    const sessionId = await Tcell.getSessionId(TCELL_USERNAME, TCELL_PASSWORD, CHARGE_VARIANT);

    let result;
    let matchID = "";

    if (change.current.retry_id) {
        const rewardData = await Api.getOne(BUGGED_REWARD_BUCKET, {
            _id: Api.toObjectId(change.current.retry_id)
        })
        matchID = rewardData.match_id;
    }

    let offer = DAILY_1GB_OFFER_ID;
    let campaign = DAILY_CAMPAIGN_ID;

    if (change.current.reward == "hourly_1") {
        offer = HOURLY_1GB_OFFER_ID;
        campaign = HOURLY_CAMPAIGN_ID;
    }

    try {
        awardRes = await Tcell.setAward(sessionId, change.current.msisdn, offer, campaign);
        if (awardRes) {
            Tcell.handleAwardResData(awardRes.data, matchId, 'manual');
        }
    } catch (err) {
        console.log("AWARD ERR: ", err)
    }

    Api.updateOne(MANUALLY_REWARD_BUCKET, { _id: Api.toObjectId(change.documentKey) }, {
        $set: { result: result, process_completed: true }
    })
}