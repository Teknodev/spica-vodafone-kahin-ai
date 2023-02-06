import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";

const REWARD_BUCKET = Environment.env.BUCKET.REWARD;
const CHARGE_BUCKET = Environment.env.BUCKET.CHARGE;
const BUGGED_REWARD_BUCKET = Environment.env.BUCKET.BUGGED_REWARD;

import jsdom from "jsdom";
import convert from "xml-js";

export async function getSessionId(spUsername, password, serviceVariantId) {
    const soapEnv = `<?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:mrns0="urn:SPGW" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
            <mrns0:createSession>
                <spId>${spUsername}</spId>
                <serviceVariantId>${serviceVariantId}</serviceVariantId>
                <password>${password}</password>
            </mrns0:createSession>
        </soap:Body>
    </soap:Envelope>`;

    const res = await Api.httpRequest("post", "https://sdp.turkcell.com.tr/spgw/services/AuthenticationPort", soapEnv, {
        "Content-Type": "text/xml",
        soapAction: "add"
    }).catch(console.error)

    if (!res) {
        return;
    }

    const dom = new jsdom.JSDOM(res.data);
    return dom.window.document.querySelector("sessionId").textContent;
}

export async function setAward(sessionID, msisdn, offerId, campaignId) {
    const soapEnv = `<soap:Envelope xmlns:soap = "http://schemas.xmlsoap.org/soap/envelope/">
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

    return Api.httpRequest("post", "https://sdp.turkcell.com.tr/proxy/external/ServiceOrderManagement", soapEnv, {
        "Content-Type": "text/xml",
        soapAction: "http://sdp.turkcell.com.tr/services/action/ServiceOrderManagement/createOrder"
    })
}

export async function sendSms(sessionId, shortNumber, msisdn, message) {
    const soapEnv = `<?xml version="1.0" encoding="UTF-8"?>
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
                        <sdp:msisdn>${msisdn}</sdp:msisdn>
                    </sdp:TO_RECEIVERS>
                    <sdp:MESSAGE_BODY>
                        <sdp:message>${message}</sdp:message>
                    </sdp:MESSAGE_BODY>
                </sdp:SendSMSInput>
            </soap:Body>
        </soap:Envelope>`;

    return Api.httpRequest("post", "https://sdp.turkcell.com.tr/proxy/external/SendMessage", soapEnv, {
        "Content-Type": "text/xml",
        soapAction: "http://sdp.turkcell.com.tr/services/action/SendMessage/SendSMS"
    })
}

export async function charge(sessionID, userName, crmCustomerId, msisdn, offerId) {
    const date = new Date();
    const transactionDate = `${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(-2)}${(
        "0" + date.getDate()
    ).slice(-2)}`;

    const soapEnv = `<?xml version="1.0" encoding="UTF-8"?>
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
                    <par:userName>${userName}</par:userName>
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
                    <par:crmCustomerId>${crmCustomerId}</par:crmCustomerId>
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

    return Api.httpRequest("post", "https://sdp.turkcell.com.tr/proxy/external/partnerdisposableservicecharge", soapEnv, {
        "Content-Type": "text/xml",
        soapAction: "http://sdp.turkcell.com.tr/services/action/PartnerChargeService/createOrder"
    })
}

export async function handleAwardResData(data, matchId, type) {
    const content = JSON.parse(convert.xml2json(data, { compact: true, spaces: 4 }));
    let result = undefined;

    try {
        result = content["S:Envelope"]["S:Body"]["ns1:ServiceOrderManagementResponse"];
    } catch (err) {
        console.log("AWARD HANDLE ERR: ", err)
        return;
    }

    const status = result["line"]["lineItem"]["businessInteraction"];
    const rewardData = {
        order_id: parseInt(result["ns1:orderId"]["_text"]),
        offer_id: parseInt(result["line"]["lineItem"]["offerId"]["_text"]),
        date: new Date(),
        error_id: status ? status["error"]["errorId"]["_text"] : "",
        user_text: status ? status["error"]["userText"]["_text"] : "",
        status: status ? false : true,
        result: data,
        match_id: matchId || "",
        type: type || "",
        msisdn: result["line"]["identifierForLineOfferId"]["_text"]
    };

    if (rewardData.status) {
        await Api.insertOne(REWARD_BUCKET, rewardData)
    } else {
        await Api.insertOne(BUGGED_REWARD_BUCKET, rewardData)
    }

}

export async function handleSendSmsResData(data) {
    const content = JSON.parse(convert.xml2json(data, { compact: true, spaces: 4 }));

    try {
        const smsOutput = content["env:Envelope"]["env:Body"]["sdp:SendSMSOutput"]
        const statusCode = content["env:Envelope"]["env:Body"]["sdp:SendSMSOutput"]["so:TSOresult"]["so:statusCode"]["_text"];
        return {
            smsOutput,
            statusCode: parseInt(statusCode)
        }
    } catch (err) {
        console.log("SEND SMS HANDLE ERR: ", err)
        return;
    }
}

export async function handleChargeResData(data) {
    const content = JSON.parse(convert.xml2json(data, { compact: true, spaces: 4 }));
    let result = undefined;

    try {
        result = content["S:Envelope"]["S:Body"]["ns1:DisposableServiceCreateOrderResponse"];
    } catch (err) {
        console.log("CHARGE HANDLE ERR: ", err)
        return { status: false, message: "Hata oluştu, daha sonra dene " };
    }

    if (result) {
        const status = result["line"]["businessInteraction"];
        const chargeData = {
            order_id: parseInt(result["ns1:orderId"]["_text"]),
            date: new Date(),
            user_text: status ? status["error"]["userText"]["_text"] : "",
            status: status ? false : true,
            result: data,
            msisdn: result["line"]["msisdn"]["_text"]
        };

        Api.insertOne(CHARGE_BUCKET, chargeData)
    } else {
        return { status: false, message: "Hata oluştu, daha sonra dene " };
    }

    const isContinue = result["line"]["continue"]["_text"];
    if (isContinue == "true") {
        return { status: true, message: "OK" };
    } else {
        if (result["line"]["businessInteraction"]["error"]["userText"]["_text"]) {
            return {
                status: false,
                message: result["line"]["businessInteraction"]["error"]["userText"]["_text"]
            };
        }
        return { status: false, message: "Hata oluştu, daha sonra dene " };

    }
}