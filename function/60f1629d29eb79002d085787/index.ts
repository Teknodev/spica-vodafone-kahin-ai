import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";

const CryptoJS = require("crypto-js");
const json2csv = require("json2csv").parse;

const PAST_MATCH_BUCKET = Environment.env.BUCKET.PAST_MATCH;
const USER_BUCKET = Environment.env.BUCKET.USER;
const REWARD_LOG_BUCKET = Environment.env.BUCKET.REWARD_LOG;
const CHARGE_LOG_BUCKET = Environment.env.BUCKET.CHARGE_LOG;
const MANUALLY_REWARD_BUCKET = Environment.env.BUCKET.MANUALLY_REWARD;
const CONTACT_BUCKET = Environment.env.BUCKET.CONTACT;
const CONFIGURATION_BUCKET = Environment.env.BUCKET.CONFIGURATION;
const BUGGED_REWARD_BUCKET = Environment.env.BUCKET.BUGGED_REWARD;

const CHARGE_AMOUNT = Environment.env.TCELL.CHARGE_AMOUNT;

const unauthorizedResMsg = {
    statusCode: 401,
    message: "No auth token",
    error: "Unauthorized"
};

export async function matchChart(req, res) {
    if (req.query.key != "wutbztACHHbT") {
        return res.status(401).send(unauthorizedResMsg);
    }

    let begin = new Date().setHours(-3, 0, 0, 0);
    let end = new Date();

    if (req.query.filter != "undefined") {
        let filter = JSON.parse(req.query.filter);

        if (filter.begin) {
            begin = filter.begin;
        }

        if (filter.end) {
            end = filter.end;
        }
    }

    let oneDay = 1000 * 3600 * 24;
    let beginDate = new Date(begin);
    let endDate = new Date(end);
    let days = Math.ceil((endDate.getTime() - beginDate.getTime()) / oneDay);

    let paidvsPaidP2P = [];
    let freevsPaidP2P = [];
    let freevsFreeP2P = [];
    let freevsBot = [];
    let paidvsBot = [];
    let total = [];
    let label = [];

    for (let day = 0; day < days; day++) {
        let previousDay = new Date(beginDate.getTime() + day * oneDay);
        let nextDay = new Date(beginDate.getTime() + (day + 1) * oneDay);
        if (nextDay.getTime() > endDate.getTime()) {
            nextDay.setTime(endDate.getTime());
        }
        let result = await getMatches(previousDay, nextDay).catch(err =>
            console.log("ERROR 2", err)
        );

        paidvsPaidP2P.push(result.paidvsPaidP2P);
        freevsPaidP2P.push(result.freevsPaidP2P);
        freevsFreeP2P.push(result.freevsFreeP2P);
        freevsBot.push(result.freevsBot);
        paidvsBot.push(result.paidvsBot);
        total.push(result.total);

        label.push(
            `${("0" + previousDay.getDate()).slice(-2)}-${(
                "0" +
                (previousDay.getMonth() + 1)
            ).slice(-2)}-${previousDay.getFullYear()}`
        );
    }
    return res.status(200).send({
        title: "Daily Chart",
        options: {
            legend: { display: true }, responsive: true,
        },
        label: label,
        datasets: [
            { data: paidvsPaidP2P, label: "Paid VS Paid" },
            { data: freevsPaidP2P, label: "Free VS Paid" },
            { data: freevsFreeP2P, label: "Free VS Free" },
            { data: paidvsBot, label: "Paid VS Bot" },
            { data: freevsBot, label: "Free VS Bot" },
            { data: total, label: "Total Matches" }
        ],
        legend: true,
        width: 10,
        filters: [
            { key: "begin", type: "date", value: beginDate },
            { key: "end", type: "date", value: endDate }
        ]
    });

}

export async function totalMatchChart(req, res) {
    if (req.query.key != "wutbztACHHbT") {
        return res.status(401).send(unauthorizedResMsg);
    }

    let begin = new Date().setHours(-3, 0, 0, 0);
    let end = new Date();

    if (req.query.filter != "undefined") {
        let filter = JSON.parse(req.query.filter);

        if (filter.begin) {
            begin = filter.begin;
        }

        if (filter.end) {
            end = filter.end;
        }
    }
    let beginDate = new Date(begin);
    let endDate = new Date(end);
    let result = await getMatches(beginDate, endDate).catch(err => console.log("ERROR 4", err));


    return res.status(200).send({
        title: "Total Chart",
        options: { legend: { display: true }, responsive: true },
        label: ["Paid VS Paid", "Free VS Paid", "Free VS Free", "Paid VS Bot", "Free VS Bot"],
        data: [
            result.paidvsPaidP2P,
            result.freevsPaidP2P,
            result.freevsFreeP2P,
            result.paidvsBot,
            result.freevsBot
        ],
        legend: true,
        filters: [
            { key: "begin", type: "date", value: beginDate },
            { key: "end", type: "date", value: endDate }
        ]
    });


}

async function getMatches(begin, end) {
    const db = await Api.useDatabase();
    const pastMachesCollection = db.collection(`bucket_${PAST_MATCH_BUCKET}`);
    let dateFilter = {
        $gte: begin,
        $lt: end
    };

    const paidvsPaidP2P = await pastMachesCollection
        .find({
            player_type: 0,
            user1_is_free: false,
            user2_is_free: false,
            end_time: dateFilter
        })
        .count()
        .catch(err => console.log("ERROR 5", err));

    const freevsPaidP2P = await pastMachesCollection
        .find({
            player_type: 0,
            $or: [
                { user1_is_free: false, user2_is_free: true },
                { user1_is_free: true, user2_is_free: false }
            ],
            end_time: dateFilter
        })
        .count()
        .catch(err => console.log("ERROR 6", err));

    const freevsFreeP2P = await pastMachesCollection
        .find({
            player_type: 0,
            user1_is_free: true,
            user2_is_free: true,
            end_time: dateFilter
        })
        .count()
        .catch(err => console.log("ERROR 7", err));

    const paidvsBot = await pastMachesCollection
        .find({
            player_type: 1,
            user1_is_free: false,
            end_time: dateFilter
        })
        .count()
        .catch(err => console.log("ERROR 8", err));

    const freevsBot = await pastMachesCollection
        .find({
            player_type: 1,
            user1_is_free: true,
            end_time: dateFilter
        })
        .count()
        .catch(err => console.log("ERROR 9", err));

    let result = {
        paidvsPaidP2P,
        freevsPaidP2P,
        freevsFreeP2P,
        freevsBot,
        paidvsBot,
        total: paidvsPaidP2P + freevsPaidP2P + freevsFreeP2P + freevsBot + paidvsBot
    };

    return result;
}

export async function dashboardPastMatches(req, res) {
    if (req.query.key != "wutbztACHHbT") {
        return res.status(401).send(unauthorizedResMsg);
    }

    const db = await Api.useDatabase();
    let msisdn = "";
    let begin = new Date("12-31-2021 21:00:0");
    let end = new Date();
    let tableData = [];

    if (req.query.filter != "undefined") {
        let filter = JSON.parse(req.query.filter);
        if (filter.begin) {
            begin = new Date(filter.begin);
        }

        if (filter.end) {
            end = new Date(filter.end);
        }
        msisdn = filter.msisdn;

        if (msisdn) {
            const usersCollection = db.collection(`bucket_${USER_BUCKET}`);
            const pastMatchesCollection = db.collection(`bucket_${PAST_MATCH_BUCKET}`);


            const identityCollection = db.collection(`identity`);
            const identity = await identityCollection
                .findOne({ "attributes.msisdn": msisdn })
                .catch(err => console.log("ERROR 12 ", err));
            const user = await usersCollection
                .findOne({ identity: identity._id.toString() })
                .catch(err => console.log("ERROR 13 ", err));

            let userId = user._id;

            let dateFilter = {
                $gte: begin,
                $lt: end
            };

            const pastMatches = await pastMatchesCollection.aggregate([
                {
                    $match: {
                        $or: [{ user1: userId.toString() }, { user2: userId.toString() }],
                        start_time: dateFilter
                    },
                },
                {
                    $set: {
                        _id: {
                            $toString: "$_id"
                        },
                        user1: {
                            $toObjectId: "$user1"
                        },
                        user2: {
                            $toObjectId: "$user2"
                        }
                    }
                },
                {
                    $lookup: {
                        from: `bucket_${USER_BUCKET}`,
                        localField: "user1",
                        foreignField: "_id",
                        as: "user1"
                    }
                },
                {
                    $lookup: {
                        from: `bucket_${USER_BUCKET}`,
                        localField: "user2",
                        foreignField: "_id",
                        as: "user2"
                    }
                },
            ])
                .sort({ _id: -1 })
                .toArray()

            pastMatches.forEach(data => {
                let startTime = new Date(data.start_time);
                let endTime = new Date(data.end_time);
                startTime.setHours(startTime.getHours() + 3);
                endTime.setHours(endTime.getHours() + 3);

                let obj = {
                    duel_id: data._id,
                    user1: data.user1[0].name,
                    user2: data.user2[0].name,
                    winner: data.winner,
                    player_type: data.player_type == 0 ? "PVP" : "PVE",
                    user1_is_free: data.user1_is_free,
                    user2_is_free: data.user2_is_free,
                    start_time: startTime,
                    end_time: endTime
                };
                tableData.push(obj);
            });

        }
    }

    return {
        title: "Math",
        data: tableData,
        displayedColumns: [
            "duel_id",
            "user1",
            "user2",
            "winner",
            "player_type",
            "user1_is_free",
            "user2_is_free",
            "start_time",
            "end_time"
        ],
        filters: [
            { key: "msisdn", type: "string", value: msisdn, title: "msisdn" },
            { key: "begin", type: "date", value: begin },
            { key: "end", type: "date", value: end }
        ]
    };
}

export async function dashboardUserRewards(req, res) {
    if (req.query.key != "wutbztACHHbT") {
        return res.status(401).send(unauthorizedResMsg);
    }

    let msisdn = "";
    let begin = new Date("12-31-2021 21:00:0");
    let end = new Date();
    let rewards = [];

    if (req.query.filter != "undefined") {
        let filter = JSON.parse(req.query.filter);
        if (filter.begin) {
            begin = new Date(filter.begin);
        }

        if (filter.end) {
            end = new Date(filter.end);
        }
        msisdn = filter.msisdn;

        if (msisdn) {
            msisdn = formatMsisdnTo_90(msisdn);

            const db = await Api.useDatabase();
            const rewardsCollection = db.collection(`bucket_${REWARD_LOG_BUCKET}`);

            let dateFilter = {
                $gte: begin,
                $lt: end
            };

            rewards = await rewardsCollection
                .find({
                    msisdn: msisdn,
                    date: dateFilter
                })
                .sort({ _id: -1 })
                .toArray()
                .catch(err => console.log("ERROR 16 ", err));

            rewards = rewards.map(data => {
                let date = new Date(data.date);
                date.setHours(date.getHours() + 3);
                return {
                    _id: data._id,
                    order_id: data.order_id,
                    offer_id: data.offer_id,
                    date: date,
                    status: data.status,
                    match_id: data.match_id
                };
            });
        }
    }

    return {
        title: "User Rewards",
        data: rewards,
        displayedColumns: ["_id", "order_id", "offer_id", "date", "status", "match_id"],
        filters: [
            { key: "msisdn", type: "string", value: msisdn, title: "msisdn" },
            { key: "begin", type: "date", value: begin },
            { key: "end", type: "date", value: end }
        ]
    };
}

export async function userDashboardCharges(req, res) {
    if (req.query.key != "wutbztACHHbT") {
        return res.status(401).send(unauthorizedResMsg);
    }
    let msisdn = "";
    let begin = new Date("12-31-2021 21:00:0");
    let end = new Date();
    let charges = [];

    if (req.query.filter != "undefined") {
        let filter = JSON.parse(req.query.filter);
        if (filter.begin) {
            begin = new Date(filter.begin);
        }

        if (filter.end) {
            end = new Date(filter.end);
        }
        msisdn = filter.msisdn;

        if (msisdn) {
            msisdn = formatMsisdnTo_90(msisdn);

            const db = await Api.useDatabase();
            const chargesCollection = db.collection(`bucket_${CHARGE_LOG_BUCKET}`);
            let dateFilter = {
                $gte: begin,
                $lt: end
            };

            charges = await chargesCollection
                .find({
                    msisdn: msisdn,
                    date: dateFilter
                })
                .sort({ _id: -1 })
                .toArray()
                .catch(err => console.log("ERROR 21 ", err));


            charges = charges.map(data => {
                let date = new Date(data.date);

                date.setHours(date.getHours() + 3);
                return {
                    _id: data._id,
                    date: date,
                    amount: CHARGE_AMOUNT,
                    status: data.status,
                    user_text: data.user_text
                };
            });
        }
    }

    return {
        title: "User Charges",
        data: charges,
        displayedColumns: ["_id", "date", "amount", "status", "user_text"],
        filters: [
            { key: "msisdn", type: "string", value: msisdn, title: "msisdn" },
            { key: "begin", type: "date", value: begin },
            { key: "end", type: "date", value: end }]
    };
}

export async function dashboardDuelAnswers(req, res) {
    if (req.query.key != "wutbztACHHbT") {
        return res.status(401).send(unauthorizedResMsg);
    }
    let duelId = "";
    let resultArr = [];

    if (req.query.filter != "undefined") {
        let filter = JSON.parse(req.query.filter);
        duelId = filter.duel_id;

        if (duelId) {
            const db = await Api.useDatabase();
            let user1Arr = [];
            let user2Arr = [];


            const pastMatchesCollection = db.collection(`bucket_${PAST_MATCH_BUCKET}`);

            const pastMatches = await pastMatchesCollection
                .findOne({
                    _id: Api.toObjectId(duelId)
                })
                .catch(err => console.log("ERROR 18 ", err));

            if (pastMatches.user1_answers) {
                let total_point = 0;
                let life_count = 4;
                if (pastMatches.user1_is_free) {
                    life_count = 0;
                }
                pastMatches.user1_answers.forEach(data => {
                    let obj = {}
                    let parsed = JSON.parse(data);

                    let date = new Date(parsed.date);
                    date.setHours(date.getHours() + 3);

                    if (!parsed.user_answer_is_right) {
                        life_count = Math.max(life_count - 1, 0)
                        if (life_count == 0) {
                            total_point -= total_point > 0 ? 10 : 0
                        }
                    } else {
                        total_point += (parsed.earned_point || 0)
                    }

                    obj['u1_question'] = parsed.question;
                    obj['u1_right_answer'] = parsed.is_right_answer;
                    obj['u1_level'] = parsed.level;
                    obj['u1_answer'] = parsed.user_answer;
                    obj['u1_point'] = parsed.earned_point || 0;
                    obj['u1_total_point'] = total_point;
                    obj['u1_answer_date'] = date;
                    user1Arr.push(obj);
                });
            }

            if (pastMatches.user2_answers) {
                let total_point = 0;
                let life_count = 4;
                if (pastMatches.user2_is_free) {
                    life_count = 0;
                }

                pastMatches.user2_answers.forEach(data => {
                    let obj = {}
                    let parsed = JSON.parse(data);

                    let date = new Date(parsed.date);
                    date.setHours(date.getHours() + 3);


                    if (!parsed.user_answer_is_right) {
                        life_count = Math.max(life_count - 1, 0)
                        if (life_count == 0) {
                            total_point -= total_point > 0 ? 10 : 0
                        }
                    } else {
                        total_point += (parsed.earned_point || 0)
                    }

                    obj['u2_question'] = parsed.question;
                    obj['u2_right_answer'] = parsed.is_right_answer;
                    obj['u2_level'] = parsed.level;
                    obj['u2_answer'] = parsed.user_answer;
                    obj['u2_point'] = parsed.earned_point || 0;
                    obj['u2_total_point'] = total_point;
                    obj['u2_answer_date'] = date;

                    user2Arr.push(obj);
                });
            }

            let firstArr = user2Arr;
            let secondArr = user1Arr;
            if (user1Arr.length >= user2Arr.length) {
                firstArr = user1Arr;
                secondArr = user2Arr;
            }

            resultArr = firstArr.map((data, index) => {
                if (user2Arr[index]) {
                    return data = { ...data, ...secondArr[index] }
                } else return data
            })
        }
    }

    return {
        title: "Math Answers",
        data: resultArr,
        displayedColumns: [
            "u1_question",
            "u1_right_answer",
            "u1_level",
            "u1_answer",
            "u1_point",
            "u1_total_point",
            "u1_answer_date",
            "u2_question",
            "u2_right_answer",
            "u2_level",
            "u2_answer",
            "u2_point",
            "u2_total_point",
            "u2_answer_date",
        ],
        filters: [{ key: "duel_id", type: "string", value: duelId, title: "duel_id" }]
    };
}


export async function playedUsersCount(req, res) {
    if (req.query.key != "wutbztACHHbT") {
        return res.status(401).send(unauthorizedResMsg);
    }
    let begin = new Date().setDate(new Date().getDate() - 1);
    let end = new Date();

    if (req.query.filter != "undefined") {
        let filter = JSON.parse(req.query.filter);

        if (filter.begin) {
            begin = filter.begin;
        }

        if (filter.end) {
            end = filter.end;
        }
    }

    let beginDate = new Date(begin).setHours(new Date(begin).getHours() + 3);
    let endDate = new Date(end).setHours(new Date(end).getHours() + 3);

    let dateFilter = {
        $gte: new Date(beginDate),
        $lt: new Date(endDate)
    };

    const db = await Api.useDatabase();
    const pastMatchesCollection = db.collection(`bucket_${PAST_MATCH_BUCKET}`);

    let user1Paid = await pastMatchesCollection
        .aggregate([
            { $match: { end_time: dateFilter, user1_is_free: false } },
            { $group: { _id: "$user1" } }
        ])
        .toArray()
        .catch(err => console.log("ERROR 39", err));

    let user2Paid = await pastMatchesCollection
        .aggregate([
            {
                $match: {
                    end_time: dateFilter,
                    player_type: 0,
                    user2_is_free: false
                }
            },
            { $group: { _id: "$user2" } }
        ])
        .toArray()
        .catch(err => console.log("ERROR 40", err));

    let user1Free = await pastMatchesCollection
        .aggregate([
            { $match: { end_time: dateFilter, user1_is_free: true } },
            { $group: { _id: "$user1" } }
        ])
        .toArray()
        .catch(err => console.log("ERROR 41", err));

    let user2Free = await pastMatchesCollection
        .aggregate([
            {
                $match: {
                    end_time: dateFilter,
                    player_type: 0,
                    user2_is_free: true
                }
            },
            { $group: { _id: "$user1" } }
        ])
        .toArray()
        .catch(err => console.log("ERROR 42", err));

    user1Paid = user1Paid.map(el => el._id);
    user2Paid = user2Paid.map(el => el._id);
    user1Free = user1Free.map(el => el._id);
    user2Free = user2Free.map(el => el._id);
    let paid = [...new Set([...user1Paid, ...user2Paid])];
    let free = [...new Set([...user1Free, ...user2Free])];

    let allData = paid.concat(free);
    let uniq = [...new Set(allData)];

    let total = uniq.length;

    paid = paid.length;
    free = free.length;



    return res.status(200).send({
        title: "Math Played Users",
        options: { legend: { display: true }, responsive: true },
        label: ["Paid", "Free", "Total"],
        data: [paid, free, total],
        legend: true,
        filters: [
            { key: "begin", type: "date", value: new Date(begin) },
            { key: "end", type: "date", value: new Date(end) }
        ]
    });
}

export async function getManuallyRewardDashboard(req, res) {
    return {
        title: "Manually Reward",
        description:
            "Inputların içine numaraları virgül (5353334422,5321234567 şeklinde) ile ayrılmış şekilde yazabilirsiniz. " +
            "Tek seferde hem saatlik hemde günlük yükleyebilirsiniz.",
        inputs: [
            {
                key: "daily",
                type: "string",
                value: "",
                title: "Daily Reward MSISDNS"
            },
            {
                key: "key",
                type: "string",
                value: "",
                title: "Dashboard Key"
            }
        ],
        button: {
            color: "primary",
            target:
                "https://math-tcell-c6415.hq.spicaengine.com/api/fn-execute/dashboardManuallyReward",
            method: "get",
            title: "Send Request"
        }
    };
}

export async function dashboardManuallyReward(req, res) {
    const db = await Api.useDatabase();
    const configurationCollection = db.collection(`bucket_${CONFIGURATION_BUCKET}`);
    const dashboard_key = await configurationCollection.findOne({ key: "dashboard_key" }).catch(err => console.log("Error", err))
    if (req.query.key != dashboard_key.value) {
        return res.status(401).send(unauthorizedResMsg);
    }

    const Bucket = Api.useBucket();
    let dailyMsisdns = req.query.daily;
    dailyMsisdns = dailyMsisdns ? dailyMsisdns.split(",") : [];

    if (dailyMsisdns[0]) {
        console.log("Daily Reward Msisdn: ", dailyMsisdns[0])
        for (let msisdn of dailyMsisdns) {
            await Bucket.data
                .insert(MANUALLY_REWARD_BUCKET, {
                    msisdn: Number(msisdn),
                    reward: "daily_1"
                })
                .catch(error => {
                    console.log("ERROR 14", error);
                });
        }
    }

    await generateDashboardKey();


    return res.status(200).send({
        message: "successfully",
    });

}

export async function dashboardGetContacts(req, res) {
    if (req.query.key != "wutbztACHHbT") {
        return res.status(401).send(unauthorizedResMsg);
    }
    let beginDate = new Date().setDate(new Date().getDate() - 7);
    let endDate = new Date();

    const db = await Api.useDatabase();
    let contactCollection = db.collection(`bucket_${CONTACT_BUCKET}`)
    const contacts = await contactCollection.find(
        {
            created_at: {
                $gte: new Date(beginDate), $lte: new Date(endDate)
            }
        }
    ).toArray().catch(err => console.log("Error", err))



    contacts.reverse();
    contacts.forEach((contact) => {
        delete contact['about']
    })

    return {
        title: "Math Contacts",
        data: contacts,
        displayedColumns: [
            "_id",
            "name",
            "email",
            "note",
            "msisdn",
            "user",
            "read",
            "fixed",
            "created_at",
            "message"
        ],
        filters: [
            { key: "begin", type: "date", value: beginDate },
            { key: "end", type: "date", value: endDate }
        ]
    };
}

export async function updateContact(req, res) {
    const { read, fixed, contact_id, note } = req.body

    const db = await Api.useDatabase();
    let contactCollection = db.collection(`bucket_${CONTACT_BUCKET}`)

    let data = {}

    data['read'] = read == 'true' ? true : false
    data['fixed'] = fixed == 'true' ? true : false
    if (note) data['note'] = note

    await contactCollection.updateOne(
        { _id: Api.toObjectId(contact_id) },
        { $set: data }
    )

    return true;
}

function generatePassword() {
    let length = 16,
        charset = "0123456789abcdefghijklmnopqrstuvwxyz!@#$%^&*()ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
}

export async function generateDashboardKey() {
    const db = await Api.useDatabase();
    const configurationCollection = db.collection(`bucket_${CONFIGURATION_BUCKET}`);

    await configurationCollection
        .updateOne(
            { key: "dashboard_key" },
            { $set: { value: generatePassword() } }
        )
        .catch(e => console.log(e));



    return true;
}

export async function getDashboarKey(req, res) {
    if (req.query.key != "smlc49YjPoddQg)n") {
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
    }

    const db = await Api.useDatabase();
    const configurationCollection = db.collection(`bucket_${CONFIGURATION_BUCKET}`);
    const dashboard_key = await configurationCollection.findOne({ key: "dashboard_key" }).catch(err => console.log("Error", err))

    let hashData = CryptoJS.AES.encrypt(JSON.stringify(dashboard_key.value), 'dashboard_key').toString();

    return res.status(200).send({ key: hashData })
}


export async function getLeaderUsersDashboard(req, res) {
    let limit = 10;
    let begin = new Date().setDate(new Date().getDate() - 7);
    let end = new Date();

    if (req.query.filter != "undefined") {
        let filter = JSON.parse(req.query.filter);
        if (filter.begin) {
            begin = filter.begin;
        }

        if (filter.end) {
            end = filter.end;
        }

        limit = Number(filter.limit);
    }

    let beginDate = new Date(begin);
    let endDate = new Date(end);

    let dateFilter = {
        $gte: beginDate,
        $lt: endDate
    };

    const db = await Api.useDatabase();
    const pastMatchesCollection = db.collection(`bucket_${PAST_MATCH_BUCKET}`);
    const userCollection = db.collection(`bucket_${USER_BUCKET}`);
    const identityCollection = db.collection(`identity`);

    let user1Matches = await pastMatchesCollection
        .aggregate([
            { $match: { end_time: dateFilter } },
            {
                $group: {
                    _id: "$user1",
                    // point: { $sum: "$user1_points" },
                    count: { $sum: 1 },
                    win_count: {
                        $sum: {
                            $cond: {
                                if: {
                                    $eq: [
                                        "$winner",
                                        1
                                    ]
                                }, then: 1, else: 0
                            }
                        }
                    },
                    paid_match: {
                        $sum: {
                            $cond: {
                                if: {
                                    $eq: [
                                        "$user1_is_free",
                                        false
                                    ]
                                },
                                then: 1,
                                else: 0
                            }
                        }
                    },
                }
            },
            { $sort: { win_count: -1 } },
            { $limit: limit }
        ])
        .toArray()
        .catch(err => console.log("ERROR", err));


    let user2Matches = await pastMatchesCollection
        .aggregate([
            { $match: { end_time: dateFilter, player_type: 0 } },
            {
                $group: {
                    _id: "$user2",
                    // point: { $sum: "$user2_points" },
                    count: { $sum: 1 },
                    win_count: {
                        $sum: {
                            $cond: {
                                if: {
                                    $eq: [
                                        "$winner",
                                        2
                                    ]
                                }, then: 1, else: 0
                            }
                        }
                    },
                    paid_match: {
                        $sum: {
                            $cond: {
                                if: {
                                    $eq: [
                                        "$user2_is_free",
                                        false
                                    ]
                                },
                                then: 1,
                                else: 0
                            }
                        }
                    },
                }
            },
            { $sort: { win_count: -1 } },
            { $limit: limit }
        ])
        .toArray()
        .catch(err => console.log("ERROR ", err));

    const uniqueUsers = [];
    const usersId = [];
    const usersIdentity = [];

    user1Matches.forEach(user => {
        usersId.push(Api.toObjectId(user._id))
        let user2 = user2Matches.find(el => { return user._id == el._id })
        if (user2) {
            let obj = {
                _id: user._id,
                // point: user.point + user2.point,
                match_count: user.count + user2.count,
                match_win_count: user.win_count + user2.win_count,
                match_lose_count: (user.count + user2.count) - (user.win_count + user2.win_count),
                paid_matches: user.paid_match + user2.paid_match,
                free_matches: (user.count + user2.count) - (user.paid_match + user2.paid_match)
            }
            uniqueUsers.push(obj)
        } else {
            user['match_count'] = user.count;
            user['match_win_count'] = user.win_count;
            user['match_lose_count'] = user.count - user.win_count
            user['paid_matches'] = user.paid_match;
            user['free_matches'] = user.count - user.paid_match;
            uniqueUsers.push(user)
        }
    })

    const usersArr = await userCollection.find({ _id: { $in: usersId } }).toArray().catch(err => console.log("ERROR ", err));

    usersArr.forEach(user => {
        usersIdentity.push(Api.toObjectId(user.identity))
    })

    const identities = await identityCollection
        .find({ _id: { $in: usersIdentity } })
        .toArray()
        .catch(err => console.log("ERROR ", err));

    usersArr.map(user => {
        let userIdentity = identities.find(identity => { return String(identity._id) == user.identity })
        let userMatchData = uniqueUsers.find(el => { return user._id == el._id })

        // user['earned_points'] = userMatchData.point;
        user['match_count'] = userMatchData.match_count;
        user['match_win_count'] = userMatchData.match_win_count;
        user['match_lose_count'] = userMatchData.match_lose_count;
        user['paid_matches'] = userMatchData.paid_matches;
        user['free_matches'] = userMatchData.free_matches;
        user['msisdn'] = userIdentity.attributes.msisdn;
        return user;
    })

    let tableData = [];
    usersArr.forEach(data => {
        let obj = {
            _id: data._id,
            name: data.name,
            msisdn: data.msisdn,
            // available_play_count: data.available_play_count,
            match_count: data.match_count,
            match_win_count: data.match_win_count,
            match_lose_count: data.match_lose_count || 0,
            paid_matches: data.paid_matches,
            free_matches: data.free_matches,
            // earned_points: data.earned_points
        };
        tableData.push(obj);
    });

    tableData.sort((a, b) => b.match_win_count - a.match_win_count);

    return {
        title: "Leaderboards",
        data: tableData,
        displayedColumns: [
            "_id",
            "name",
            "msisdn",
            "match_count",
            "match_win_count",
            "match_lose_count",
            "paid_matches",
            "free_matches",
            // "available_play_count",
            // "earned_points",
        ],
        filters: [
            { key: "limit", type: "string", value: limit, title: "limit" },
            { key: "begin", type: "date", value: beginDate },
            { key: "end", type: "date", value: endDate }
        ]
    };

}

export async function dahsboardBuggedRewards(req, res) {
    if (req.query.key != "wutbztACHHbT") {
        return res.status(401).send(unauthorizedResMsg);
    }


    let msisdn = "";
    let begin = new Date("12-31-2021 21:00:0");
    let end = new Date();
    let rewards = [];

    if (req.query.filter != "undefined") {
        let filter = JSON.parse(req.query.filter);
        if (filter.begin) {
            begin = new Date(filter.begin);
        }

        if (filter.end) {
            end = new Date(filter.end);
        }
        msisdn = filter.msisdn;

        if (msisdn) {
            msisdn = formatMsisdnTo_90(msisdn);

            const db = await Api.useDatabase();

            const rewardsCollection = db.collection(`bucket_${BUGGED_REWARD_BUCKET}`);
            let dateFilter = {
                $gte: begin,
                $lt: end
            };
            rewards = await rewardsCollection
                .find({
                    msisdn: msisdn,
                    date: dateFilter
                })
                .sort({ _id: -1 })
                .toArray()
                .catch(err => console.log("ERROR 16 ", err));


            rewards = rewards.map(data => {
                let date = new Date(data.date);
                date.setHours(date.getHours() + 3);
                return {
                    _id: data._id,
                    order_id: data.order_id,
                    offer_id: data.offer_id,
                    date: date.toLocaleDateString(),
                    time: getTwentyFourHourTime(date.toLocaleTimeString()),
                    status: data.status,
                    match_id: data.match_id
                };
            });
        }
    }


    return {
        title: "User Bugged Rewards",
        data: rewards,
        displayedColumns: ["_id", "order_id", "offer_id", "date", "time", "status", "match_id"],
        filters: [
            { key: "msisdn", type: "string", value: msisdn, title: "msisdn" },
            { key: "begin", type: "date", value: begin },
            { key: "end", type: "date", value: end }
        ]
    };
}

function getTwentyFourHourTime(amPmString) {
    var d = new Date("1/1/2021 " + amPmString);
    let currentHours = d.getHours()
    currentHours = ("0" + currentHours).slice(-2);

    let currentMinutes = d.getMinutes()
    currentMinutes = ("0" + currentMinutes).slice(-2);

    let currentSeconds = d.getSeconds()
    currentSeconds = ("0" + currentSeconds).slice(-2);

    return currentHours + ':' + currentMinutes + ':' + currentSeconds;
}


export async function dashboardUserAnalysisReport(req, res) {
    if (req.query.key != "wutbztACHHbT") {
        return res.status(401).send(unauthorizedResMsg);
    }
    let now = new Date();
    let beginDate = new Date(now.setDate(now.getDate() - 1));
    let endDate = new Date();
    return {
        title: "Kullanıcı Analiz Raporu",
        description:
            "Analiz raporunu oluşturmak için, maçların başlangıç ve bitiş tarihlerini girerek, indir butonuna basınız.",
        inputs: [
            // { key: "msisdn", type: "string", value: "", title: "Msisdn" },
            { key: "begin", type: "date", value: beginDate, title: "Başlangıç Tarihi" },
            { key: "end", type: "date", value: endDate, title: "Bitiş Tarihi" },
            { key: "key", type: "string", value: "dlw2RH32NjSd", title: "Değiştirmeyin" },
        ],
        button: {
            color: "primary",
            target:
                "https://math-tcell-c6415.hq.spicaengine.com/api/fn-execute/downloadUserAnalysisReport",
            method: "get",
            title: "İndir"
        }
    };
}

export async function downloadUserAnalysisReport(req, res) {
    if (req.query.key == "dlw2RH32NjSd") {
        const db = await Api.useDatabase();

        let beginDate = new Date(req.query.begin);
        let endDate = new Date(req.query.end);

        const identityIds = [];
        const tableData = [];

        const identityCollection = db.collection(`identity`);

        const pastMatches = await db.collection(`bucket_${PAST_MATCH_BUCKET}`)
            .find({ start_time: { $gte: beginDate, $lte: endDate } })
            .toArray().catch(error => {
                console.log("ERROR ", error);
            });

        const users = [];
        if (pastMatches.length) {
            pastMatches.forEach(data => {
                users.push(Api.toObjectId(data.user1))
                if (data.player_type == 0) {
                    users.push(Api.toObjectId(data.user2))
                }
            })
        }

        const usersData = await db.collection(`bucket_${USER_BUCKET}`)
            .find({ _id: { $in: users } }).toArray().catch(error => {
                console.log("ERROR ", error);
            });

        let usersObject = {};
        if (usersData.length) {
            usersData.forEach(user => {
                usersObject[user._id] = user.identity;
                identityIds.push(Api.toObjectId(user.identity))
            })
        }

        let userIdentitiesObject = {};
        const identities = await identityCollection
            .find({ _id: { $in: identityIds } }).toArray()
            .catch(err => console.log("ERROR 12 ", err));

        identities.forEach(identity => {
            userIdentitiesObject[identity._id.toString()] = identity.attributes.msisdn;
        })

        pastMatches.forEach(data => {
            let startTime = new Date(data.start_time);
            let endTime = new Date(data.end_time);
            startTime.setHours(startTime.getHours() + 3);
            endTime.setHours(endTime.getHours() + 3);

            let users = [data.user1]
            if (data.player_type == 0) users.push(data.user2)

            for (let [index, user] of users.entries()) {

                let userData = usersObject[user]

                if (userData) {

                    let userIdentity = userIdentitiesObject[userData];

                    if (userIdentity) {
                        let opponent = '';
                        let date = `${startTime.getDate()}/${startTime.getMonth() + 1}/${startTime.getFullYear()} ${getTwentyFourHourTime(startTime.toLocaleTimeString())}`
                        if (data.player_type == 0) {
                            if (index == 0) {
                                opponent = data[`user2_is_free`] ? 'free' : 'paid'
                            } else {
                                opponent = data[`user1_is_free`] ? 'free' : 'paid'
                            }
                        } else {
                            opponent = 'bot';
                        }

                        let obj = {
                            date: date,
                            msisdn: userIdentity,
                            services_name: "4 İşlem Bol GB",
                            fee_type: data[`user${index + 1}_is_free`] ? "free" : "paid",
                            charge_amount: data[`user${index + 1}_is_free`] ? "-" : "4TL",
                            winner: data.winner,
                            opponent: opponent
                        };
                        tableData.push(obj);
                    }
                }
            }
        });

        const fields = [
            { label: "Tarih", value: 'date' },
            { label: "Msisdn", value: 'msisdn' },
            { label: "Oyun Adı", value: 'services_name' },
            { label: "Ücret Tipi", value: 'fee_type' },
            { label: "Charge Ücreti", value: 'charge_amount' },
            { label: "Maç Sonucu", value: 'winner' },
            { label: "Rakip", value: 'opponent' }
        ];

        let formattedString = json2csv(tableData, { fields });

        res.headers.set(
            "Content-Disposition",
            `attachment; filename=math-${beginDate.toLocaleDateString()}&${endDate.toLocaleDateString()}.xlsx`
        );

        return res.status(200).send(formattedString);

    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function dahsboardUserPoints(req, res) {
    if (req.query.key != "wutbztACHHbT") {
        return res.status(401).send(unauthorizedResMsg);
    }

    let msisdn = "";
    let begin = new Date("12-31-2021 21:00:0");
    let end = new Date();
    let tableData = [];

    if (req.query.filter != "undefined") {
        let filter = JSON.parse(req.query.filter);
        if (filter.begin) {
            begin = new Date(filter.begin);
        }

        if (filter.end) {
            end = new Date(filter.end);
        }
        msisdn = filter.msisdn;
        if (msisdn) {
            const db = await Api.useDatabase();

            const usersCollection = db.collection(`bucket_${USER_BUCKET}`);

            const identityCollection = db.collection(`identity`);
            const identity = await identityCollection
                .findOne({ "attributes.msisdn": msisdn })
                .catch(err => console.log("ERROR 12 ", err));

            const user = await usersCollection
                .findOne({ identity: identity._id.toString() })
                .catch(err => console.log("ERROR 13 ", err));

            let userId = user._id;

            const pastMatchesCollection = db.collection(`bucket_${PAST_MATCH_BUCKET}`);
            let pastMatches = await pastMatchesCollection
                .find({
                    $or: [{ user1: userId.toString() }, { user2: userId.toString() }],
                })
                .sort({ _id: 1 })
                .toArray()
                .catch(err => console.log("ERROR 16 ", err));

            let totalPoint = 0;

            pastMatches.forEach((match) => {
                let userOrder = 1;
                if (match.user1 != userId) {
                    userOrder = 2;
                }

                totalPoint += match[`user${userOrder}_points`]

                tableData.push({
                    match_id: match._id,
                    start_date: match.start_time.toLocaleDateString(),
                    start_time: getTwentyFourHourTime(match.start_time.toLocaleTimeString()),
                    match_point: match[`user${userOrder}_points`],
                    total_point: totalPoint,
                    opponent_point: userOrder == 1 ? match.user2_points : match.user1_points,
                    winner: match.winner == 3 ? 'berabere' : userOrder == match.winner ? 'kazandı' : 'kaybetti'
                })
            })

            tableData = tableData.filter(el => {
                return new Date(el.start_date) >= begin && new Date(el.start_date) <= end
            })

            tableData.sort((a, b) => b.total_point - a.total_point)

        }
    }

    return {
        title: "User Match Points",
        data: tableData,
        displayedColumns: ["match_id", "start_date", "start_time", "match_point", "total_point", "opponent_point", "winner"],
        filters: [
            { key: "msisdn", type: "string", value: msisdn, title: "msisdn" },
            { key: "begin", type: "date", value: begin },
            { key: "end", type: "date", value: end }
        ]
    };
}


function formatMsisdnTo_90(msisdn) {
    if (msisdn.charAt(0) == '0') {
        msisdn = `9${msisdn}`
    } else if (msisdn.charAt(0) == '5') {
        msisdn = `90${msisdn}`
    }

    return msisdn
}