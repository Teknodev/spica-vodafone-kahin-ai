import { database, ObjectId } from "@spica-devkit/database";
import * as Identity from "@spica-devkit/identity";
var jwt = require("jsonwebtoken");

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const DUEL_BUCKET_ID = process.env.DUEL_BUCKET_ID;
const SECRET_API_KEY = process.env.SECRET_API_KEY;


let db;

export async function playCountDecrease(req, res) {
	const { userId } = req.body;

	if (!db) {
		db = await database().catch(err => console.log("ERROR 30", err));
	}

	let token = getToken(req.headers.get("authorization"));
	let token_object = await tokenVerified(token);

	const userCollection = db.collection(`bucket_${USER_BUCKET_ID}`);

	if (token_object.error === false) {
		let setQuery = {}
		const user = await userCollection.findOne({ _id: ObjectId(userId) }).catch(err => {
			console.log("ERROR 1 ", err)
		})

		if (user.free_play) {
			setQuery = { free_play: false }
		} else setQuery = {
			available_play_count: Math.max(
				user.available_play_count - 1,
				0
			)
		}

		await userCollection.updateOne({ _id: ObjectId(userId) }, {
			$set: setQuery
		}).catch(err => console.log("ERROR 2 ", err))

		return res.status(200).send({ message: "successful" });
	} else {
		return res.status(400).send({ message: "Token is not verified." });
	}
}

export async function setReady(req, res) {
	const { duelId, user_placement } = req.body;

	if (!db) {
		db = await database().catch(err => console.log("ERROR 30", err));
	}

	let token = getToken(req.headers.get("authorization"));
	let token_object = await tokenVerified(token);

	const duelCollection = db.collection(`bucket_${DUEL_BUCKET_ID}`);

	if (token_object.error === false) {
		let setQuery = {}
		setQuery[user_placement] = true
		await duelCollection.updateOne({ _id: ObjectId(duelId) }, {
			$set: setQuery
		}).catch(err => console.log("ERROR 2 ", err))
		return res.status(200).send({ message: "successful" });
	} else {
		return res.status(400).send({ message: "Token is not verified." });
	}
}

export async function changeAvatar(req, res) {
	const { userId, avatarId } = req.body;
	if (!db) {
		db = await database().catch(err => console.log("ERROR 30", err));
	}

	let token = getToken(req.headers.get("authorization"));
	let token_object = await tokenVerified(token);

	const userCollection = db.collection(`bucket_${USER_BUCKET_ID}`);

	if (token_object.error === false) {
		await userCollection.updateOne({ _id: ObjectId(userId) }, {
			$set: { avatar_id: avatarId }
		}).catch(err => console.log("ERROR 2 ", err))
		return res.status(200).send({ message: "successful" });
	} else {
		return res.status(400).send({ message: "Token is not verified." });
	}
}

export async function changeName(req, res) {
    const { userId, name } = req.body;
    if (!db) {
        db = await database().catch(err => console.log("ERROR 30", err));
    }

    let token = getToken(req.headers.get("authorization"));
    let token_object = await tokenVerified(token);

    const userCollection = db.collection(`bucket_${USER_BUCKET_ID}`);

    if (token_object.error === false) {
        await userCollection.updateOne({ _id: ObjectId(userId) }, {
            $set: { name: name }
        }).catch(err => console.log("ERROR 2 ", err))
        return res.status(200).send({ message: "successful" });
    } else {
        return res.status(400).send({ message: "Token is not verified." });
    }
}

function getToken(token) {
    if (token) {
        token = token.split(" ")[1];
    } else {
        token = "";
    }
    return token;
}

async function tokenVerified(token) {
    /* -request object
        error: true | false,
        decoded_token: token
     */

    let response_object = {
        error: false
    };

    Identity.initialize({ apikey: `${SECRET_API_KEY}` });
    const decoded = await Identity.verifyToken(token).catch(err => response_object.error = true)
    response_object.decoded_token = decoded;

    return response_object;
}


// export async function addNewBots(req, res) {
// 	if (!db) {
// 		db = await database().catch(err => console.log("ERROR 30", err));
// 	}

// 	const { data } = req.body;

// 	const botsCollection = db.collection(`bucket_61517461d0398a002e618021`);

// 	data.forEach(el => {
// 		el._id = ObjectId(el._id)
// 	})

// 	await botsCollection.insert(data).catch(err => console.log(err))


// 	return res.status(200).send(true)
// }