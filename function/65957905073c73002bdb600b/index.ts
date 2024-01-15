import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

export function sendPassword(msisdn, password) {
    let message = `https://www.sayikrali.com adresine giris yapmak icin kullanacaginiz sifre: ${password}`;
    sendSms(msisdn, message);
}

export async function sendSms(msisdn, message) {
    console.log("@sendSms")

    const url = "https://apigateway.vodafone.com.tr/sendSms"
    // "https://apigateway.vodafone.com.tr/sendSms/Test"; // test URL
    // "https://apigateway.vodafone.com.tr/sendSms" // prod URL

    // 34.132.15.52
    const headers = {
        "X-API-USERNAME": "2focxj6prz",
        "X-API-PASSWORD": "qqz22ia23h",
        "X-Forwarded-For": "104.197.250.30",
        "Apikey": "3e66366d-871d-4efd-ac3f-9c0e2b149b3b"
    };

    const body = {
        "msisdn": msisdn,
        "serviceKey": "CONSMSMTSAYIKRALI",
        "channel": "SMS",
        "messageBody": message,
    }

    const result = await Api.httpRequest('post', url, body, headers)
        .then(res => res.data)
        .catch(error => {
            if (error.response && error.response.data) {
                console.log("error.response.data: ", error.response.data)
            }
            console.log("ERROR: ", error)
        });

    if (result) {
        Api.insertOne(VARIABLE.BUCKET.SMS_LOG, {
            msisdn,
            message,
            created_at: new Date(),
            response: JSON.stringify(result)
        }).catch(console.error)
    }
}