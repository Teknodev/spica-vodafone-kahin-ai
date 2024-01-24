import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const PAST_MATCH_BUCKET = VARIABLE.BUCKET.PAST_MATCH;
const REWARD_LOG_BUCKET = VARIABLE.BUCKET.REWARD_LOG;
const MAILER_BUCKET = VARIABLE.BUCKET.MAILER;
const MATCH_REPORT_BUCKET = VARIABLE.BUCKET.MATCH_REPORT;
const USER_BUCKET = VARIABLE.BUCKET.USER;
const USER_REPORT_BUCKET = VARIABLE.BUCKET.USER_REPORT;
const ANSWER_TO_QUESTION_REPORT_BUCKET = VARIABLE.BUCKET.ANSWER_TO_QUESTION_REPORT;
const REWARD_REPORT_BUCKET = VARIABLE.BUCKET.REWARD_REPORT;
const NOTIFICATION_LOG_BUCKET = VARIABLE.BUCKET.NOTIFICATION_LOG;
const SUBSCRIPTION_REPORT_BUCKET = VARIABLE.BUCKET.SUBSCRIPTION_REPORT;

export async function executeReportDaily() {
    let date = new Date().setDate(new Date().getDate() - 1)
    let dateFrom = new Date(date).setHours(0, 0, 0);
    let dateTo = new Date(date).setHours(23, 59, 59);

    await Promise.all([
        userReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 1", err)),
        matchReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 2", err)),
        getRewards(0, dateFrom, dateTo).catch(err => console.log("ERROR: 3", err)),
        subscriptionReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 4", err)),
        questionReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 5", err)),
    ]).catch(console.error)

    await reportExportSend("Günlük Rapor", 0).catch(err => console.log("ERROR: 5", err));

    return true;
}

export async function executeReportWeekly() {
    await reportExportSend("Haftalık Toplam Rapor", 1).catch(err => console.log("ERROR: 63", err));
    await reportExportSend("Haftalık Gün Bazlı Rapor", 11).catch(err =>
        console.log("ERROR: 63", err)
    );

    return true;
}

export async function executeReportMonthly() {
    await reportExportSend("Aylık Gün Bazlı Rapor", 22).catch(err =>
        console.log("ERROR: 163", err)
    );
    await reportExportSend("Aylık Toplam Rapor", 2).catch(err =>
        console.log("ERROR: 163", err)
    );

    return true;
}

async function userReport(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    const reportDate = new Date().setDate(new Date().getDate() - 1)

    const usersCount = await Api.getCount(USER_BUCKET);
    const newUsersCount = await Api.getCountByFilter(USER_BUCKET, {
        created_at: {
            $gte: dateFrom,
            $lt: dateTo
        }
    })

    await Api.insertOne(USER_REPORT_BUCKET, {
        date: new Date(reportDate),
        total_user: usersCount,
        new_user: newUsersCount,
        created_at: new Date(),
        report_type: reportType
    })

    return true;
}

async function matchReport(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    const reportDate = new Date().setDate(new Date().getDate() - 1)
    const endTimeFilter = {
        end_time: {
            $gte: dateFrom,
            $lt: dateTo
        }
    }

    let p2pMatchPointsEarned = 0,
        p2mMatchPointsEarned = 0,
        p2pPoints = 0,
        p2mPoints = 0;

    const matches = await Api.getMany(PAST_MATCH_BUCKET, endTimeFilter)

    const p2pMatches = matches.filter(el => el.player_type == 0)
    const p2mMatches = matches.filter(el => el.player_type == 1)

    p2pMatches.forEach(match => {
        p2pMatchPointsEarned += match.points_earned;

        if (match.winner == 3) {
            p2pPoints += 200;
        } else {
            p2pPoints += 150;
        }

    });

    p2mMatches.forEach(match => {
        p2mMatchPointsEarned += match.points_earned;
        if (match.winner == 3) {
            p2mPoints += 200;
        } else {
            p2mPoints += 100;
        }
    });

    const playedMatch = await playedMatchCount(endTimeFilter);

    await Api.insertOne(MATCH_REPORT_BUCKET, {
        date: new Date(reportDate),
        p2p_play: p2pMatches.length,
        p2p_play_points_earned: p2pMatchPointsEarned,
        p2p_play_points: p2pPoints,
        p2m_play: p2mMatches.length,
        p2m_play_points_earned: p2mMatchPointsEarned,
        p2m_play_points: p2mPoints,
        report_type: reportType,
        player: playedMatch.player,
        play: playedMatch.play
    })

    return true;
}

async function playedMatchCount(endTimeFilter) {
    const db = await Api.useDatabase();
    const pastMatchesCollection = db.collection(`bucket_${PAST_MATCH_BUCKET}`);

    const groupUsrer1 = { $group: { _id: "$user1" } };
    const groupUsrer2 = { $group: { _id: "$user2" } };

    let user1 = await pastMatchesCollection
        .aggregate([
            { $match: { ...endTimeFilter } },
            { ...groupUsrer1 }
        ])
        .toArray()
        .catch(err => console.log("ERROR 39", err));

    let user2 = await pastMatchesCollection
        .aggregate([
            {
                $match: {
                    ...endTimeFilter,
                    player_type: 0,
                }
            },
            { ...groupUsrer2 }
        ])
        .toArray()
        .catch(err => console.log("ERROR 40", err));

    const p2p = await Api.getCountByFilter(PAST_MATCH_BUCKET, {
        player_type: 0,
        ...endTimeFilter
    })

    const pvb = await Api.getCountByFilter(PAST_MATCH_BUCKET, {
        player_type: 1,
        ...endTimeFilter
    })

    user1 = user1.map(el => el._id);
    user2 = user2.map(el => el._id);

    let users = [...new Set([...user1, ...user2])];

    return {
        player: users.length,
        play: p2p * 2 + pvb,
    }
}

async function getRewards(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    const reportDate = new Date().setDate(new Date().getDate() - 1)

    const db = await Api.useDatabase();
    const rewardLogsCollection = db.collection(`bucket_${REWARD_LOG_BUCKET}`);

    const rewardsData = await rewardLogsCollection.find({
        date: {
            $gte: dateFrom,
            $lt: dateTo
        }
    }).toArray();

    const result = {};

    rewardsData.forEach(transaction => {
        const { status_code, purpose } = transaction;
        if (!result[status_code]) {
            result[status_code] = {
                statusCode: status_code,
                purposeCharge: 0,
                purposePoints: 0,
            };
        }

        result[status_code][`purpose${purpose === 'charge' ? 'Charge' : 'Points'}`]++;

        const totalCount = result[status_code].purposeCharge + result[status_code].purposePoints;
        result[status_code][`purpose${purpose === 'charge' ? 'Charge' : 'Points'}Rate`] =
            totalCount === 0 ? 0 : formatNumber((result[status_code][`purpose${purpose === 'charge' ? 'Charge' : 'Points'}`] / rewardsData.length) * 100);
    });

    const output = Object.values(result);

    const promises = [];
    for (let reward of output) {
        let statusCode = reward.statusCode !== undefined ? reward.statusCode : 100;
        let data = {
            date: new Date(reportDate),
            status_code: statusCode,
            charge: reward.purposeCharge || 0,
            charge_ratio: reward.purposeChargeRate || 0,
            points: reward.purposePoints || 0,
            points_ratio: reward.purposePointsRate || 0,
            report_type: reportType
        }

        promises.push(Api.insertOne(REWARD_REPORT_BUCKET, data))
    }

    await Promise.all(promises).catch(console.error);
    return true
}

async function subscriptionReport(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    const reportDate = new Date().setDate(new Date().getDate() - 1)

    const endTimeFilter = {
        created_at: {
            $gte: dateFrom,
            $lt: dateTo
        }
    }

    const notificationsData = await Api.getMany(NOTIFICATION_LOG_BUCKET, endTimeFilter)
    const notifications = [
        "SubscriptionCreated",
        "CreateSubscriptionFailed",
        "SubscriptionSuspended",
        "SubscriptionResumed",
        "SubscriptionRenewed",
        "SubscriptionWillBeDeactivated",
        "SubscriptionDeactivated",
        "SubscriptionDeactivationFailed",
        "Refunded"
    ];

    const result = notifications.reduce((acc, notification) => {
        acc[notification] = 0;
        return acc;
    }, {});

    notificationsData.forEach((item) => {
        const { notification } = item;
        if (result.hasOwnProperty(notification)) {
            result[notification]++;
        }
    });

    Api.insertOne(SUBSCRIPTION_REPORT_BUCKET, {
        date: new Date(reportDate),
        report_type: reportType,
        subscription_created: result.SubscriptionCreated || 0,
        create_subscription_failed: result.CreateSubscriptionFailed || 0,
        subscription_suspended: result.SubscriptionSuspended || 0,
        subscription_resumed: result.SubscriptionResumed || 0,
        subscription_will_be_deactivated: result.SubscriptionWillBeDeactivated || 0,
        subscription_deactivated: result.SubscriptionDeactivated || 0,
        subscription_deactivation_failed: result.SubscriptionDeactivationFailed || 0,
        refunded: result.Refunded || 0,
    })

    return true
}

async function questionReport(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);

    const reportDate = new Date().setDate(new Date().getDate() - 1)
    const answersArr = {
        l1_correct: 0,
        l2_correct: 0,
        l3_correct: 0,
        l1_wrong: 0,
        l2_wrong: 0,
        l3_wrong: 0
    };

    const pastDuels = await Api.getMany(PAST_MATCH_BUCKET, {
        end_time: { $gte: dateFrom, $lt: dateTo }
    })

    pastDuels.forEach(duel => {
        for (let user of [1, 2]) {
            if (duel[`user${user}_answers`]) {
                duel[`user${user}_answers`].forEach(questionItem => {
                    let question = JSON.parse(questionItem);

                    if (question.user_answer_is_right) {
                        answersArr[`l${question.level}_correct`] += 1;
                    } else answersArr[`l${question.level}_wrong`] += 1;
                });
            }
        }
    });

    await Api.insertOne(ANSWER_TO_QUESTION_REPORT_BUCKET, {
        date: new Date(reportDate),
        correct_answer_1: answersArr.l1_correct,
        correct_answer_2: answersArr.l2_correct,
        correct_answer_3: answersArr.l3_correct,
        wrong_answer_1: answersArr.l1_wrong,
        wrong_answer_2: answersArr.l2_wrong,
        wrong_answer_3: answersArr.l3_wrong,
        report_type: reportType
    })

    return true;
}

async function reportExportSend(title, reportType) {
    const Bucket = Api.useBucket();
    await Bucket.data
        .insert(MAILER_BUCKET, {
            title: title,
            template: "report-mail",
            variables: `{"title": "${title}"}`,
            emails: [
                "serdar@polyhagency.com",
                "caglar@polyhagency.com",
                "idriskaribov@gmail.com",
                "ozangol@teknodev.biz",
            ],
            report_type: reportType
        })
        .catch(err => console.log("ERROR: 35", err));
    return true;
}

export async function executeReportDailyMan(req, res) {
    // let date = new Date().setDate(new Date().getDate() - 14)
    // let date1 = new Date()
    // let dateFrom = new Date(date).setHours(0, 0, 0);
    // let dateTo = new Date(date1).setHours(23, 59, 59);

    // await Promise.all([
    //     userReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 1", err)),
    //     matchReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 2", err)),
    //     getRewards(0, dateFrom, dateTo).catch(err => console.log("ERROR: 3", err)),
    //     subscriptionReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 4", err)),
    //     questionReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 5", err)),
    // ]).catch(console.error)

    // await reportExportSend("Günlük Rapor", 0).catch(err => console.log("ERROR: 5", err));

    let date = new Date().setDate(new Date().getDate() - 1)
    let dateFrom = new Date(date).setHours(0, 0, 0);
    let dateTo = new Date(date).setHours(23, 59, 59);

    await Promise.all([
        userReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 1", err)),
        matchReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 2", err)),
        getRewards(0, dateFrom, dateTo).catch(err => console.log("ERROR: 3", err)),
        subscriptionReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 4", err)),
        questionReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 5", err)),
    ]).catch(console.error)

    await reportExportSend("Günlük Rapor", 0).catch(err => console.log("ERROR: 5", err));

    return res.status(200).send({ message: 'Ok' });
}
export async function executeReportWeeklyMan(req,res) {
    await reportExportSend("Haftalık Toplam Rapor", 1).catch(err => console.log("ERROR: 63", err));
    await reportExportSend("Haftalık Gün Bazlı Rapor", 11).catch(err =>console.log("ERROR: 63", err));

    return res.status(200).send('ok');
}

function formatNumber(number) {
    if (Number.isInteger(number)) return number;
    return Number(number.toFixed(2));
}