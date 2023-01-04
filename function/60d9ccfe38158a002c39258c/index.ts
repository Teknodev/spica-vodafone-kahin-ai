import { database, ObjectId } from "@spica-devkit/database";
import * as Identity from "@spica-devkit/identity";
const axios = require("axios");
const jsdom = require("jsdom");
var jwt = require("jsonwebtoken");
var convert = require("xml-js");

const SECRET_API_KEY = process.env.SECRET_API_KEY;
const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const DUEL_BUCKET_ID = process.env.DUEL_BUCKET_ID;
const CHARGE_BUCKET_ID = process.env.CHARGE_BUCKET_ID;
const CONFIRMATION_CODE_BUCKET_ID = process.env.CONFIRMATION_CODE_BUCKET_ID;
const REWARDS_BUCKET_ID = process.env.REWARDS_BUCKET_ID;
const BUGGED_REWARDS_BUCKET_ID = process.env.BUGGED_REWARDS_BUCKET_ID;

const TCELL_USERNAME = 400026758;
const TCELL_PASSWORD = 400026758;
const MT_VARIANT = 130524;
const CHARGE_VARIANT = 132985; // Changed
const CHARGE_OFFER_ID = 457412; //Changed
const DAILY_2GB_OFFER_ID = 455884; // Changed
const HOURLY_1GB_OFFER_ID = 455883; // Changed

// const DAILY_CAMPAIGN_ID = 1236; // Changed
const HOURLY_CAMPAIGN_ID = 1236; // Changed //1236

const DAILY_1GB_OFFER_ID = 451318;
const DAILY_CAMPAIGN_ID = "871137.947567.966243";

const CHARGE_AMOUNT = "7 TL";

let db;

export async function addAvailablePlay(req, res) {
    let token = getToken(req.headers.get("authorization"));
    let token_object = tokenVerified(token);

    if (token_object.error === false) {
        let generatedCode = codeGenerate(4);
        let decoded_token = token_object.decoded_token;
        let msisdn = decoded_token.attributes.msisdn;

        if (!db) {
            db = await database().catch(err => console.log("ERROR 2", err));
        }
        const confirmationCodeCollection = db.collection(`bucket_${CONFIRMATION_CODE_BUCKET_ID}`);

        const codeData = await confirmationCodeCollection
            .findOne({
                msisdn: msisdn,
                status: false,
                is_expired: false
            })
            .catch(err => console.log("ERROR 3", err));

        if (codeData) {
            generatedCode = codeData.code;
        } else {
            await confirmationCodeCollection
                .insertOne({
                    msisdn: msisdn,
                    code: generatedCode,
                    status: false,
                    sent_date: new Date(),
                    is_expired: false
                })
                .catch(err => console.log("ERROR 4", err));
        }

        const smsRes = await sendSms(msisdn, generatedCode).catch(err =>
            console.log("ERROR 5", err)
        );

        if (smsRes) {
            return res.status(200).send({ message: "Mesaj göderildi" });
        } else {
            return res
                .status(400)
                .send({ message: "Mesaj gönderilirken bir hata oluştu, daha sonra dene" });
        }
    } else {
        return res.status(400).send({ message: "Token is not verified." });
    }
}

export async function sendSms(receiverMsisdn, code) {
    let message = `Sifreniz: ${code}. Kodu ekrana girerek vergiler dahil ${CHARGE_AMOUNT} karsiliginda GNC 4 Islem Bol GB oyunundan Gunluk 1 GB kazanacaksiniz. Oyunu kazanirsaniz ek olarak Gunluk 1 GB daha kazanacaksiniz. Basarilar!`;
    let shortNumber = 3757;

    const sessionId = await sessionSOAP(TCELL_USERNAME, TCELL_PASSWORD, MT_VARIANT).catch(err =>
        console.log("ERROR 6", err)
    );
    // return true;
    // const sessionId = false;

    if (sessionId) {
        let soapEnv = `<?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope 
        xmlns:mrns0="http://sdp.turkcell.com/mapping/TSO" 
        xmlns:sdp="http://sdp.turkcell.com.tr/mapping/generated"
        xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
        xmlns:xs="http://www.w3.org/2001/XMLSchema">
        <soap:Header>
            <sdp:token>
                <sdp:sessionId>${sessionId}</sdp:sessionId>
            </sdp:token>
        </soap:Header>
        <soap:Body>
            <sdp:SendSMSInput>
                <sdp:SHORT_NUMBER>${shortNumber}</sdp:SHORT_NUMBER>
                <sdp:TO_RECEIVERS>
                    <sdp:msisdn>${receiverMsisdn}</sdp:msisdn>
                </sdp:TO_RECEIVERS>
                <sdp:MESSAGE_BODY>
                    <sdp:message>${message}</sdp:message>
                </sdp:MESSAGE_BODY>
            </sdp:SendSMSInput>
        </soap:Body>
    </soap:Envelope>`;
        return await axios
            .post("https://sdp.turkcell.com.tr/proxy/external/SendMessage", soapEnv, {
                headers: {
                    "Content-Type": "text/xml",
                    soapAction: "http://sdp.turkcell.com.tr/services/action/SendMessage/SendSMS"
                }
            })
            .then(res => {
                let result = JSON.parse(convert.xml2json(res.data, { compact: true, spaces: 4 }));
                updateConfirmationCode(result["env:Envelope"]["env:Body"]["sdp:SendSMSOutput"], receiverMsisdn, code)
                let statusCode =
                    result["env:Envelope"]["env:Body"]["sdp:SendSMSOutput"]["so:TSOresult"][
                    "so:statusCode"
                    ]["_text"];
                if (parseInt(statusCode) == 0) {
                    return true;
                } else {
                    return false;
                }
            })
            .catch(err => {
                console.log("ERROR 7", err);
                return false;
            });
    } else return false; // SESSION ERROR
}

async function updateConfirmationCode(result, msisdn, code) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 2", err));
    }
    const confirmationCodeCollection = db.collection(`bucket_${CONFIRMATION_CODE_BUCKET_ID}`);
    await confirmationCodeCollection.updateOne({
        msisdn: msisdn,
        code: code
    },
        { $set: { result: JSON.stringify(result), result_date: new Date() } })
        .catch(err => console.log("ERROR UPDATE CODE", err));
}

async function sessionSOAP(spUsername, password, serviceVariantId) {
    // serviceVariantId = 130524;
    let soapEnv = `<?xml version="1.0" encoding="UTF-8"?>
    <soap:Envelope xmlns:mrns0="urn:SPGW" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
            <mrns0:createSession>
                <spId>${spUsername}</spId>
                <serviceVariantId>${serviceVariantId}</serviceVariantId>
                <password>${password}</password>
            </mrns0:createSession>
        </soap:Body>
    </soap:Envelope>`;

    return await axios
        .post("https://sdp.turkcell.com.tr/spgw/services/AuthenticationPort", soapEnv, {
            headers: {
                "Content-Type": "text/xml",
                soapAction: "add"
            }
        })
        .then(res => {
            let dom = new jsdom.JSDOM(res.data);
            let sessionId = dom.window.document.querySelector("sessionId").textContent;
            if (sessionId) {
                return sessionId;
            } else return false;
        })
        .catch(err => {
            console.log("ERROR 8", err);
            return false;
        });
}

async function offerTransactionSOAP(sessionID, msisdn, offerId, identity) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 9", err));
    }
    let date = new Date();
    let transactionDate = `${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(-2)}${(
        "0" + date.getDate()
    ).slice(-2)}`;

    let soapEnv = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:gen="http://sdp.turkcell.com.tr/mapping/generated" xmlns:par="http://extranet.turkcell.com/ordermanagement/processes/partnerdisposableservicecharge/PartnerDisposableServiceChargeTypes">
    <soapenv:Header>
        <gen:token>
            <sessionId>${sessionID}</sessionId>
        </gen:token>
    </soapenv:Header>
    <soapenv:Body>
        <par:DisposableServiceCreateOrderRequest>
            <par:header>
                <par:user>
                <par:userName>${TCELL_USERNAME}</par:userName>
                <par:ipAddress>104.197.250.30</par:ipAddress>
                <par:dealer>
                    <par:dealerCode>TTB34.00009</par:dealerCode>
                    <par:subDealerCode>?</par:subDealerCode>
                </par:dealer>
                </par:user>
                <par:channel>
                <par:channelId>23</par:channelId>
                <par:applicationId>514</par:applicationId>
                </par:channel>
                <par:transactionId>7890${transactionDate}0${offerId}</par:transactionId>
            </par:header>
            <par:customer>
                <par:crmCustomerId>${TCELL_USERNAME}</par:crmCustomerId>
            </par:customer>
            <!--1 or more repetitions:-->
            <par:lineItem>
                <par:msisdn>${msisdn}</par:msisdn>
                <par:offerId>${offerId}</par:offerId>
            </par:lineItem>
            <par:synchronize>true</par:synchronize>
        </par:DisposableServiceCreateOrderRequest>
    </soapenv:Body>
    </soapenv:Envelope>`;

    const transactionRes = await axios
        .post(
            "https://sdp.turkcell.com.tr/proxy/external/partnerdisposableservicecharge",
            soapEnv,
            {
                headers: {
                    "Content-Type": "text/xml",
                    soapAction:
                        "http://sdp.turkcell.com.tr/services/action/PartnerChargeService/createOrder"
                }
            }
        )
        .then(async res => {
            let content = JSON.parse(convert.xml2json(res.data, { compact: true, spaces: 4 }));

            if (content["S:Envelope"]["S:Body"]["ns1:DisposableServiceCreateOrderResponse"]) {
                let result =
                    content["S:Envelope"]["S:Body"]["ns1:DisposableServiceCreateOrderResponse"];
                let status = result["line"]["businessInteraction"];

                let chargeData = {
                    order_id: parseInt(result["ns1:orderId"]["_text"]),
                    date: new Date(),
                    user_text: status ? status["error"]["userText"]["_text"] : "",
                    status: status ? false : true,
                    result: res.data,
                    msisdn: result["line"]["msisdn"]["_text"]
                };

                await db
                    .collection("bucket_60ab7235c03a2d002eb2f574")
                    .insertOne(chargeData)
                    .catch(err => console.log("ERROR 10", err));
            }

            if (!content["S:Envelope"]["S:Body"]["ns1:DisposableServiceCreateOrderResponse"]) {
                console.log("ERROR CONTENT", content["S:Envelope"]["S:Body"]["S:Fault"]);
                return { status: false, message: "Hata oluştu, daha sonra dene " };
            }

            let isContinue =
                content["S:Envelope"]["S:Body"]["ns1:DisposableServiceCreateOrderResponse"]["line"][
                "continue"
                ]["_text"];
            if (isContinue == "true") {
                return { status: true, message: "OK" };
            } else {
                if (
                    content["S:Envelope"]["S:Body"]["ns1:DisposableServiceCreateOrderResponse"][
                    "line"
                    ]["businessInteraction"]["error"]["userText"]["_text"]
                ) {
                    return {
                        status: false,
                        message:
                            content["S:Envelope"]["S:Body"][
                            "ns1:DisposableServiceCreateOrderResponse"
                            ]["line"]["businessInteraction"]["error"]["userText"]["_text"]
                    };
                } else {
                    return { status: false, message: "Hata oluştu, daha sonra dene " };
                }
            }
        })
        .catch(err => {
            console.log("ERROR 11", err);
            return {
                status: false,
                message: "Hata oluştu. Ayarlar sayfasından bize ulaşabilirsin"
            };
        });

    return transactionRes;
}

async function increaseAvailablePlay(msisdn) {
    Identity.initialize({ apikey: `${SECRET_API_KEY}` });
    const identity = await Identity.getAll({
        filter: { "attributes.msisdn": String(msisdn) }
    }).catch(err => console.log("ERROR 12", err));

    if (!db) {
        db = await database().catch(err => console.log("ERROR 13", err));
    }
    const usersCollection = db.collection(`bucket_${USER_BUCKET_ID}`);

    return usersCollection
        .findOne({ identity: identity[0]._id })
        .then(user => {
            let available_play = user.available_play_count
                ? Number(user.available_play_count) + 1
                : 1;
            return usersCollection
                .findOneAndUpdate(
                    { _id: ObjectId(user._id) },
                    {
                        $set: { available_play_count: available_play }
                    }
                )
                .then(res => {
                    return true;
                })
                .catch(err => {
                    console.log("ERROR update available_play_count: ", err);
                    return false;
                });
        })
        .catch(err => {
            console.log(`Error: ${err}`);
            return false;
        });
}

function getToken(token) {
    if (token) {
        token = token.split(" ")[1];
    } else {
        token = "";
    }
    return token;
}

function tokenVerified(token) {
    let response_object = {
        error: false
    };

    let decoded = "";

    try {
        decoded = jwt.verify(token, `${JWT_SECRET_KEY}`);

        response_object.decoded_token = decoded;
    } catch (err) {
        response_object.error = true;
    }

    return response_object;
}

function codeGenerate(length) {
    let result = "";
    let characters = "123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return parseInt(result);
}

export async function getWinner(change) {
    let user1 = change.document.user1;
    let user2 = change.document.user2;
    let bot_id = "";
    let msisdns = [];
    let winners = [];
    let users = [user1, user2];
    let usersPlayType = [
        change.document.user1_is_free || false,
        change.document.user2_is_free || false
    ];

    const resUsers = await getUsersData(users).catch(err => console.log("ERROR 14", err));
    msisdns = resUsers.msisdns;
    bot_id = resUsers.bot_id;
    if (change.document.winner == 1) {
        if (user1 != bot_id) winners = [user1];
    } else if (change.document.winner == 2) {
        if (user2 != bot_id) winners = [user2];
    } else if (change.document.winner == 3) {
        winners = [user1];
        if (user2 != bot_id) winners = [user1, user2];
    }

    if (winners.length == 1) {
        if (users[0] == winners[0]) {
            setAward(msisdns, 0, usersPlayType, change.document._id);
        } else {
            setAward(msisdns, 1, usersPlayType, change.document._id);
        }
    } else if (winners.length == 2) {
        setAward(msisdns, 0, usersPlayType, change.document._id);
        setAward(msisdns, 1, usersPlayType, change.document._id);
    }
}

async function setAward(msisdns, winnerIndex, usersPlayType, matchId) {
    const sessionId = await sessionSOAP(TCELL_USERNAME, TCELL_PASSWORD, CHARGE_VARIANT).catch(err =>
        console.log("ERROR 15", err)
    );
    if (sessionId) {
        // at the beginning of the game
        if (msisdns[winnerIndex]) {
            if (usersPlayType[winnerIndex]) {
                await setAwardSOAP(
                    sessionId,
                    msisdns[winnerIndex],
                    DAILY_1GB_OFFER_ID,
                    DAILY_CAMPAIGN_ID,
                    matchId,
                    'match'
                ).catch(err => console.log("ERROR 16", err));
            }
            // winner award
            else {
                await setAwardSOAP(
                    sessionId,
                    msisdns[winnerIndex],
                    DAILY_1GB_OFFER_ID,
                    DAILY_CAMPAIGN_ID,
                    matchId,
                    'match'
                ).catch(err => console.log("ERROR 17", err));
            }
        }
        return true;
    } else return false;
}

async function getUsersData(users) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 22", err));
    }
    Identity.initialize({ apikey: `${SECRET_API_KEY}` });

    const usersCollection = db.collection(`bucket_${USER_BUCKET_ID}`);
    const identityCollection = db.collection(`identity`);

    // let userPromises = [];
    // let identityPromises = [];
    // let usersData = [];
    let bot_id = "";
    let msisdns = [];

    const user1 = await usersCollection
        .findOne({ _id: ObjectId(users[0]) })
        .catch(err => console.log("ERROR 23: ", err));

    const user2 = await usersCollection
        .findOne({ _id: ObjectId(users[1]) })
        .catch(err => console.log("ERROR 24: ", err));

    if (user1.bot == false) {
        const user1Identity = await identityCollection
            .findOne({ _id: ObjectId(user1.identity) })
            .catch(err => console.log("ERROR 25 ", err));

        // const user1Identity = await Identity.get(user1.identity).catch(err =>
        //     console.log("ERROR 25", err)
        // );

        msisdns.push(user1Identity.attributes.msisdn);
    } else {
        bot_id = user1._id;
    }

    if (user2.bot == false) {
        const user2Identity = await identityCollection
            .findOne({ _id: ObjectId(user2.identity) })
            .catch(err => console.log("ERROR 26 ", err));
        // const user2Identity = await Identity.get(user2.identity).catch(err =>
        //     console.log("ERROR 26", err)
        // );
        msisdns.push(user2Identity.attributes.msisdn);
    } else {
        bot_id = user2._id;
    }

    return { msisdns: msisdns, bot_id: bot_id };
}

export async function testSetAward() {
    // let msisdn = 5322101428;
    // const sessionId = await sessionSOAP(TCELL_USERNAME, TCELL_PASSWORD, CHARGE_VARIANT);
    // await setAwardSOAP(sessionId, msisdn, DAILY_1GB_OFFER_ID, DAILY_CAMPAIGN_ID);
}

async function setAwardSOAP(sessionID, msisdn, offerId, campaignId, matchId = "", type) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 27", err));
    }
    let soapEnv = `<soap:Envelope xmlns:soap = "http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <ns4:token
            xmlns:ns4 = "http://sdp.turkcell.com.tr/mapping/generated"
            xmlns:ns3 = "http://extranet.turkcell.com/ordermanagement/processes/serviceordermanagement/ServiceOrderManagement_v1.0"
            xmlns:ns2 = "http://extranet.turkcell.com/ordermanagement/processes/serviceordermanagement/ServiceOrderManagementTypes">
            <sessionId>${sessionID}</sessionId>
        </ns4:token>
    </soap:Header>
    <soap:Body>
        <ns2:CreateOrderRequest
            xmlns:ns2 = "http://extranet.turkcell.com/ordermanagement/processes/serviceordermanagement/ServiceOrderManagementTypes"
            xmlns:ns3 = "http://extranet.turkcell.com/ordermanagement/processes/serviceordermanagement/ServiceOrderManagement_v1.0"
            xmlns:ns4 = "http://sdp.turkcell.com.tr/mapping/generated">
            <ns2:header>
                <ns2:channelApplication>
                    <ns2:channelId>514</ns2:channelId>
                </ns2:channelApplication>
            </ns2:header>
            <ns2:orderLine>
                <ns2:msisdn>${msisdn}</ns2:msisdn>
                <ns2:orderLineItem>
                    <ns2:offerId>${offerId}</ns2:offerId>
                    <ns2:campaignId>${campaignId}</ns2:campaignId>
                    <ns2:action>1</ns2:action>
                </ns2:orderLineItem>
            </ns2:orderLine>
        </ns2:CreateOrderRequest>
    </soap:Body>
    </soap:Envelope>`;

    return await axios
        .post("https://sdp.turkcell.com.tr/proxy/external/ServiceOrderManagement", soapEnv, {
            headers: {
                "Content-Type": "text/xml",
                soapAction:
                    "http://sdp.turkcell.com.tr/services/action/ServiceOrderManagement/createOrder"
            }
        })
        .then(async res => {
            let content = JSON.parse(convert.xml2json(res.data, { compact: true, spaces: 4 }));

            if (content["S:Envelope"]["S:Body"]["ns1:ServiceOrderManagementResponse"]) {
                let result = content["S:Envelope"]["S:Body"]["ns1:ServiceOrderManagementResponse"];
                let status = result["line"]["lineItem"]["businessInteraction"];
                let rewardData = {
                    order_id: parseInt(result["ns1:orderId"]["_text"]),
                    offer_id: parseInt(result["line"]["lineItem"]["offerId"]["_text"]),
                    date: new Date(),
                    error_id: status ? status["error"]["errorId"]["_text"] : "",
                    user_text: status ? status["error"]["userText"]["_text"] : "",
                    status: status ? false : true,
                    result: res.data,
                    match_id: matchId || "",
                    type: type || "",
                    msisdn: result["line"]["identifierForLineOfferId"]["_text"]
                };

                if (rewardData.status) {
                    await db
                        .collection("bucket_" + REWARDS_BUCKET_ID)
                        .insertOne(rewardData)
                        .catch(err => console.log("ERROR 28: ", err));
                } else {
                    await db
                        .collection("bucket_" + BUGGED_REWARDS_BUCKET_ID)
                        .insertOne(rewardData)
                        .catch(err => console.log("ERROR 40: ", err));
                }
            }

            /*let result = JSON.parse(convert.xml2json(res.data, { compact: true, spaces: 4 }));
            let businessInteraction =
                result["S:Envelope"]["S:Body"]["ns1:ServiceOrderManagementResponse"]["line"][
                    "lineItem"
                ]["businessInteraction"];*/
            return res.data;
        })
        .catch(err => {
            console.log("ERROR 29", err);
            return err;
        });
}

export async function checkSMSCode(req, res) {
    const { shortCode } = req.body;
    if (!db) {
        db = await database().catch(err => console.log("ERROR 30", err));
    }
    const confirmationCodeCollection = db.collection(`bucket_${CONFIRMATION_CODE_BUCKET_ID}`);
    let token = getToken(req.headers.get("authorization"));
    let token_object = tokenVerified(token);

    if (token_object.error === false) {
        let decoded_token = token_object.decoded_token;
        return await confirmationCodeCollection
            .findOne({
                msisdn: String(decoded_token.attributes.msisdn),
                code: Number(shortCode),
                status: false,
                is_expired: false
            })
            .then(async code => {
                if (code) {
                    confirmationCodeCollection.updateOne(
                        {
                            _id: ObjectId(code._id)
                        },
                        { $set: { status: true, confirmed_date: new Date() } }
                    );
                    const chargeRes = await charge(
                        decoded_token.attributes.msisdn,
                        decoded_token._id
                    );

                    if (chargeRes.status) {
                        return res.status(200).send({ status: true });
                    } else {
                        return res.status(400).send({ status: false, message: chargeRes.message });
                    }
                } else {
                    return res.status(400).send({ status: false, message: "Yanlış kod girdin" });
                }
            })
            .catch(err => {
                console.log("ERROR 31: ", err);
                return res
                    .status(400)
                    .send({ status: false, message: "Hata oluştu, daha sonra dene" });
            });
    } else {
        return res.status(400).send({ message: "Token is not verified." });
    }
}

export async function charge(msisdn, identity) {
    // return true;
    // msisdn = 5322101428;
    // msisdn = "3467524304";

    const sessionId = await sessionSOAP(TCELL_USERNAME, TCELL_PASSWORD, CHARGE_VARIANT).catch(err =>
        console.log("ERROR 32", err)
    );
    const transactionRes = await offerTransactionSOAP(
        sessionId,
        msisdn,
        CHARGE_OFFER_ID,
        identity
    ).catch(err => console.log("ERROR 33", err));
    // const transactionRes = false;

    if (transactionRes.status) {
        await setAwardSOAP(sessionId, msisdn, DAILY_1GB_OFFER_ID, DAILY_CAMPAIGN_ID, '', 'charge').catch(err =>
            console.log("ERROR 20", err)
        );

        return await increaseAvailablePlay(msisdn)
            .then(res => {
                if (res) {
                    return { status: true };
                } else {
                    return { status: false, message: "Oyun hakkı eklendiğinde bir hata oluştu" };
                }
            })
            .catch(err => {
                console.log("ERROR 34: ", err);
                return { status: false, message: "Oyun hakkı eklendiğinde bir hata oluştu" };
            });
    } else {
        return transactionRes;
    }
}

export async function applyRewardManually(change) {
    const sessionId = await sessionSOAP(TCELL_USERNAME, TCELL_PASSWORD, CHARGE_VARIANT).catch(err =>
        console.log("ERROR 35", err)
    );
    let result;
    let matchID = "";

    if (!db) {
        db = await database().catch(err => console.log("ERROR 38", err));
    }
    if (change.current.retry_id) {
        let rewardsCollection = db.collection("bucket_" + BUGGED_REWARDS_BUCKET_ID);
        matchID = await rewardsCollection
            .find({
                _id: ObjectId(change.current.retry_id)
            })
            .toArray()
            .catch(err => console.log(err));
        matchID = matchID[0].match_id;
    }
    if (change.current.reward == "hourly_1") {
        result = await setAwardSOAP(
            sessionId,
            change.current.msisdn,
            HOURLY_1GB_OFFER_ID,
            HOURLY_CAMPAIGN_ID,
            matchID,
            'manual'
        ).catch(err => console.log("ERROR 36", err));
    } else if (change.current.reward == "daily_1") {
        result = await setAwardSOAP(
            sessionId,
            change.current.msisdn,
            DAILY_1GB_OFFER_ID,
            DAILY_CAMPAIGN_ID,
            matchID,
            'manual'
        ).catch(err => console.log("ERROR 37", err));
    }
    let manuallyRewardsCollection = db.collection("bucket_" + change.bucket);
    manuallyRewardsCollection
        .updateOne(
            { _id: ObjectId(change.documentKey) },
            { $set: { result: result, process_completed: true } }
        )
        .catch(err => console.log("ERROR 39", err));
}

export async function chargeTestMan(msisdn, identity) {
    // return true;
    // msisdn = 5322101428;
    // msisdn = "3467524304";
    // msisdn = "5354513340"

    const sessionId = await sessionSOAP(TCELL_USERNAME, TCELL_PASSWORD, CHARGE_VARIANT).catch(err =>
        console.log("ERROR 32", err)
    );
    const transactionRes = await offerTransactionSOAP(
        sessionId,
        msisdn,
        CHARGE_OFFER_ID,
        identity
    ).catch(err => console.log("ERROR 33", err));
    // const transactionRes = false;

    if (transactionRes.status) {
        await setAwardSOAP(sessionId, msisdn, DAILY_1GB_OFFER_ID, DAILY_CAMPAIGN_ID).catch(err =>
            console.log("ERROR 20", err)
        );

        return await increaseAvailablePlay(msisdn)
            .then(res => {
                if (res) {
                    return { status: true };
                } else {
                    return { status: false, message: "Oyun hakkı eklendiğinde bir hata oluştu" };
                }
            })
            .catch(err => {
                console.log("ERROR 34: ", err);
                return { status: false, message: "Oyun hakkı eklendiğinde bir hata oluştu" };
            });
    } else {
        return transactionRes;
    }
}