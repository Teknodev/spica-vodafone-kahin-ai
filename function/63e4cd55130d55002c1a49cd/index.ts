import * as Api from "../../63b57559ebfd83002c5defe5/.build";

export function sendMessageInChat(type, msisdn, message, expire) {
	const reqBody = {
		"txnid": "200",
		"receiver": {
			"type": 2,
			"address": msisdn
		},
	}

	if (expire) {
		reqBody["expire"] = expire;
	}

	switch (type) {
		case "playGame":
			reqBody["composition"] = {
				"list": [
					{
						"type": 13,
						"tmmtype": 0
					}]
			}

			reqBody["composition"]["list"][0]["singletmm"] = {
				"title": "4 İşlem Bol GB",
				"description": "Oyun hakkın mevcut, oynamak için tıkla! Rakibini yenersen 1 GB daha kazanırsın!",
				"image": {
					"url": "https://timsac.bip.com/scontent/v2p/bu12005116347493965/17052023/10/P20329dd100db7e529fca0d64ec9f5bb824b4204583e3737bfeb69cf5c854858f3321.jpg",
					"ratio": 1.0,
				},
				"buttonlist": [
					{
						"type": 0,
						"name": "OYNA",
						"url": `https://bip4islembolgb.com/onboard?no=${msisdn}`
					}
				]
			}
			break;
		case "errorMessage":
			reqBody["composition"] =
			{
				"list": [
					{
						"type": 13,
						"tmmtype": 0
					}]
			}

			reqBody["composition"]["list"][0]["singletmm"] = {
				"description": message,
				"buttonlist": [
					{
						"type": 0,
						"name": "Tekrar Oyna",
						"url": `https://bip4islembolgb.com/onboard?no=${msisdn}`
					}
				]
			}
			break;
		default:
			reqBody["composition"] = {
				"list": [{
					"type": 0,
					"message": message
				}]
			}
			break;
	}

	const headers = {
		"Content-Type": "application/json",
		"Authorization": "Basic YnU4OTA1NTE1ODcyMTA4MjI0OmJ1ODkwNTVhYmFiMDk3ZQ=="
	}

	return Api.httpRequest("post", "https://tes.bip.com/tes/rest/spi/sendmsgserv", reqBody, headers)
}