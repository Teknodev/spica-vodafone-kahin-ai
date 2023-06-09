import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";
import * as Tcell from "../../63b6d60cebfd83002c5e1966/.build";
import * as Helper from "../../633bf949956545002c9b7e31/.build";
import * as User from "../../63b6a403ebfd83002c5e104e/.build";
import * as BipMessage from "../../63e4cd55130d55002c1a49cd/.build";

const CHARGE_BUCKET = Environment.env.BUCKET.CHARGE;
const BUGGED_REWARD_BUCKET = Environment.env.BUCKET.BUGGED_REWARD;
const MANUALLY_REWARD_BUCKET = Environment.env.BUCKET.MANUALLY_REWARD;

const PRODUCT_DAILY = Environment.env.TCELL.PRODUCT_DAILY;
const CAMPAIGN_ID = Environment.env.TCELL.CAMPAIGN_ID;
const VARIANT_ID = Environment.env.TCELL.VARIANT_ID;
const OFFER_ID_1GB = Environment.env.TCELL.OFFER_ID_1GB;

const TCELL_USERNAME = Environment.env.TCELL.USERNAME;
const TCELL_PASSWORD = Environment.env.TCELL.PASSWORD;

export async function chargeRequest(req, res) {
    const token = Helper.getTokenByReq(req);
    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

	// if(decodedToken.attributes.msisdn == "905317828001"){
	// 	BipMessage.sendMessageInChat("playGame", "905317828001");
	// 	return res.status(200).send({ message: 'Charge request success' });
	// }
    transaction(decodedToken.attributes.msisdn, decodedToken._id, PRODUCT_DAILY)
    return res.status(200).send({ message: 'Charge request success' });
}

async function transaction(msisdn, identity, product) {
    const transactionId = Date.now()
    
    const reqBody = {
        channelId: 20,
        itemList: [
            {
                count: 1,
                id: product,
                isRemovable: true
            }
        ],
        language: "tr",
        msisdn: msisdn,
        paymentMethod: "reserve",
        isDeliverable: false,
        isBillingRequired: false,
        transactionId: `${transactionId}`
    }
    const headers = {
        "Content-Type": "application/json",
        "Authorization": "Basic YnU4OTA1NTE1ODcyMTA4MjI0OmJ1ODkwNTVhYmFiMDk3ZQ=="
    }

    try {
        await Api.httpRequest("post", "https://apigw.bip.com/pgw/paymentService", reqBody, headers)
    } catch (err) {
        console.log("ERR", err);
        BipMessage.sendMessageInChat("message", msisdn, "İşlemin gerçekleştirilirken hata oluştu");
        return {
            status: false,
            message: "Hata oluştu, daha sonra dene "
        };
    }

    const insertedData = {
        transaction_id: String(transactionId),
        msisdn: msisdn,
        identity: identity,
        date: new Date(),
        status: false
    }

    await transactionDataOperations('insert', insertedData).catch(err => console.log(err))
    return {
        status: true,
        transactionId: String(transactionId)
    };
}

async function transactionDataOperations(action, transactionData) {
    switch (action) {
        case "insert":
            await Api.insertOne(CHARGE_BUCKET, transactionData);
            return;
        case "update":
            const transaction = await Api.getOne(CHARGE_BUCKET, { transaction_id: transactionData.transaction_id })
            if (!transaction) return;
            await Api.updateOne(CHARGE_BUCKET, { _id: Api.toObjectId(transaction._id) }, { $set: transactionData })
            return {
                transactionId: transaction.transaction_id,
                msisdn: transaction.msisdn,
                identity: transaction.identity
            };
        default:
            return;
    }
}

export async function transactionListener(req, res) {
    const { str } = req.body

    const transactionRes = JSON.parse(str);

    const updatedData = {
        transaction_id: String(transactionRes.transactionId),
        commit_token: transactionRes.additionalInfo ? transactionRes.additionalInfo.commitToken : '',
        listener_result: str,
        result: transactionRes.resultCode != 0 ? 'error' : '',
        user_text: transactionRes.resultDesc || '',
        user_action_date: new Date(),
        item_id: transactionRes.itemList && transactionRes.itemList[0].itemId
    }

    const transactionData = await transactionDataOperations('update', updatedData).catch(err => console.log("ERROR ", err));

    switch (transactionRes.resultCode) {
        case 0:
            BipMessage.sendMessageInChat("message", transactionData.msisdn, "Oyun hakkın yüklenince bilgi vereceğiz", 10);
            commitService(transactionData, transactionRes.additionalInfo.commitToken);
            break;
        case 4010101:
            BipMessage.sendMessageInChat("message", transactionData.msisdn, "Faturana yansıtma işlemi yapılamadığı için bu avantajlı teklifi kaçırdın! 😔", 10);
            break;
        case 4010403:
            BipMessage.sendMessageInChat("message", transactionData.msisdn, "Turkcell’li olmadığın için bu avantajlı teklifi kaçırdın! 😔", 10);
            break;
        default:
            if (transactionData.msisdn && transactionRes.resultCode != -1101)
                BipMessage.sendMessageInChat("errorMessage", transactionData.msisdn, "İşlemin gerçekleştirilirken hata oluştu! 😔");
            break;
    }

    return res.status(200).send({
        transactionId: transactionRes.transactionId,
        resultCode: transactionRes.resultCode,
        resultDesc: transactionRes.resultDesc
    });
}

async function commitService(transactionData, commitToken) {
    const updatedData = {
        transaction_id: String(transactionData.transactionId)
    }

    const reqBody = {
        transactionId: transactionData.transactionId,
        msisdn: transactionData.msisdn,
        commitToken: commitToken,
        channelId: 20,
    }
    const headers = {
        "Content-Type": "application/json",
        "Authorization": "Basic YnU4OTA1NTE1ODcyMTA4MjI0OmJ1ODkwNTVhYmFiMDk3ZQ=="
    }

    try {
        const response = await Api.httpRequest("post", "https://apigw.bip.com/pgw/commitService", reqBody, headers);
        updatedData['commit_result'] = JSON.stringify(response.data);
        updatedData['result'] = 'success'
        updatedData['status'] = true
        successTransaction(transactionData);
    } catch (err) {
        console.log("ERR", err);
        updatedData['commit_result'] = JSON.stringify(err);
        updatedData['result'] = 'error'
        BipMessage.sendMessageInChat("message", transactionData.msisdn, "İşlemin gerçekleştirilirken hata oluştu");
    }

    transactionDataOperations('update', updatedData).catch((err) => {
        console.log("ERROR TRANSACTION DATA ", err)
    })
    return true
}

async function successTransaction(transactionData) {
    const sessionId = await Tcell.getSessionId(TCELL_USERNAME, TCELL_PASSWORD, VARIANT_ID);
    if (!sessionId) {
        return;
    }

    try {
        const awardRes = await Tcell.setAward(sessionId, transactionData.msisdn.substr(2), OFFER_ID_1GB, CAMPAIGN_ID);
        if (awardRes) {
            Tcell.handleAwardResData(awardRes.data, "", "charge");
        }
    } catch (err) {
        console.log("AWARD ERR: ", err)
    }

    incAvailablePlayByIdentity(transactionData.identity)
    setTimeout(() => {
        BipMessage.sendMessageInChat("playGame", transactionData.msisdn);
    }, 2000)

    return true;
}

async function incAvailablePlayByIdentity(identity) {
    return User.updateOne({ identity: identity }, {
        $set: {
            available_play_count: 1,
        }
    })
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

    switch (winnerOrder) {
        case 1:
            winners = [user1];
            break;
        case 2:
            if (user2 != bot_id) winners = [user2];
            break;
        case 3:
            winners = [user1];
            if (user2 != bot_id) winners = [user1, user2];
            break;
        default:
            break;
    }

    switch (winners.length) {
        case 1:
            if (users[0] == winners[0]) {
                setAward(msisdns, 0, change.document._id);
            } else {
                setAward(msisdns, 1, change.document._id);
            }
            break;
        case 2:
            setAward(msisdns, 0, change.document._id);
            setAward(msisdns, 1, change.document._id);
            break;
        default:
            break;
    }
}

async function getUsersData(users) {
    const db = await Api.useDatabase();
    const identityCollection = db.collection(`identity`);

    let bot_id = "";
    let msisdns = [];

    const user1 = await User.getOne({ _id: Api.toObjectId(users[0]) })
    const user2 = await User.getOne({ _id: Api.toObjectId(users[1]) })

    const user1Identity = await identityCollection
        .findOne({ _id: Api.toObjectId(user1.identity) })
        .catch(err => console.log("ERROR 25 ", err));

    msisdns.push(user1Identity.attributes.msisdn);

    if (user2.bot) {
        bot_id = user2._id;
    }

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

async function setAward(msisdns, winnerIndex, matchId) {
    const sessionId = await Tcell.getSessionId(TCELL_USERNAME, TCELL_PASSWORD, VARIANT_ID);
    if (!sessionId) { return false }

    if (!msisdns[winnerIndex]) { return }

    try {
        const awardRes = await Tcell.setAward(sessionId, msisdns[winnerIndex], OFFER_ID_1GB, CAMPAIGN_ID);
        if (awardRes) {
            Tcell.handleAwardResData(awardRes.data, matchId, 'match');
        }
    } catch (err) {
        console.log("AWARD ERR: ", err)
    }

    return true;
}


export async function applyRewardManually(change) {
    const sessionId = await Tcell.getSessionId(TCELL_USERNAME, TCELL_PASSWORD, VARIANT_ID);

    let awardRes;
    let matchID = "";

    if (change.current.retry_id) {
        const rewardData = await Api.getOne(BUGGED_REWARD_BUCKET, {
            _id: Api.toObjectId(change.current.retry_id)
        })
        matchID = rewardData.match_id;
    }

    try {
        awardRes = await Tcell.setAward(sessionId, change.current.msisdn, OFFER_ID_1GB, CAMPAIGN_ID);
        if (awardRes) {
            Tcell.handleAwardResData(awardRes.data, matchID, 'manual');
        }
    } catch (err) {
        console.log("AWARD ERR: ", err)
    }

    Api.updateOne(MANUALLY_REWARD_BUCKET, { _id: Api.toObjectId(change.documentKey) }, {
        $set: { result: awardRes.data, process_completed: true }
    })
}