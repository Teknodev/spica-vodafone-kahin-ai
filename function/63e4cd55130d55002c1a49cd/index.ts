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
				"title": "Retro Yılan",
				"description": "Oyun hakkın mevcut, oynamak için tıkla! Maçı kazanırsan avantajlı fiyattan 1 GB alma hakkı kazanacaksın",
				"image": {
					"url": "https://timsac.bip.com/scontent/p2p/08112022/16/P654b5a8c001a39dea1e0afc223fe00bd1c479f24c241794a5568a98e0c060f7d3302.png",
					"ratio": 1.0,
				},
				"buttonlist": [
					{
						"type": 0,
						"name": "OYNA",
						"url": `https://retroyilan.com/onboard?no=${msisdn}`
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
						"url": `https://retroyilan.com/onboard?no=${msisdn}`
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