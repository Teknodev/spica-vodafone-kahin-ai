import * as Api from "../../63b57559ebfd83002c5defe5/.build";

export async function createSubscription() {
    console.log("@createSubscription")
    const headers = {
        "X-API-USERNAME": "2focxj6prz",
        "X-API-PASSWORD": "qqz22ia23h",
        "X-Forwarded-For": "34.132.15.52",
        "Apikey": "PRDSAYIKRALI"
    };

    const body = {
        msisdn: "905367022769",
        offerKey: "OFRSAYIKRALI",
        channel: "WEB",
        token: "TKN315880221"
    }

    const result = await Api.httpRequest('post', 'https://apigateway.vodafone.com.tr/createSubscription', body, headers)
        .then(res => res.data)
        .catch(error => {
            if (error.response && error.response.data) {
                console.log("error.response.data: ", error.response.data)
            }
            console.log("ERROR: ", error)
        });

    console.log("RESULT DATA", result);

    return "ok"
}

export async function stopSubscription() {
    const headers = {
        "X-API-USERNAME": "2focxj6prz",
        "X-API-PASSWORD": "qqz22ia23h",
        "X-Forwarded-For": "34.132.15.52",
        "Apikey": "PRDSAYIKRALI"
    };

    const body = {
        msisdn: "905367022769",
        offerKey: "OFRSAYIKRALI",
        channel: "WEB",
        token: "TKN315880221"
    }

    const result = await Api.httpRequest('post', 'https://apigateway.vodafone.com.tr/stopSubscription', body, headers)
        .then(res => res.data)
        .catch(error => {
            if (error.response && error.response.data) {
                console.log("error.response.data: ", error.response.data)
            }
            console.log("ERROR: ", error)
        });

    console.log("RESULT DATA", result);
    
    return "ok"
}