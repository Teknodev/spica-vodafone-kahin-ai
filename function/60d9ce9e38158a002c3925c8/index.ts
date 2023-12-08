import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const PAST_MATCH_BUCKET = VARIABLE.BUCKET.PAST_MATCH;
const REWARD_LOG_BUCKET = VARIABLE.BUCKET.REWARD_LOG;
const CHARGE_LOG_BUCKET = VARIABLE.BUCKET.CHARGE_LOG;
const MAILER_BUCKET = VARIABLE.BUCKET.MAILER;
const MATCH_REPORT_BUCKET = VARIABLE.BUCKET.MATCH_REPORT;
const USER_BUCKET = VARIABLE.BUCKET.USER;
const USER_REPORT_BUCKET = VARIABLE.BUCKET.USER_REPORT;
const CHARGE_REPORT_BUCKET = VARIABLE.BUCKET.CHARGE_REPORT;
const USER_MATCH_REPORT_BUCKET = VARIABLE.BUCKET.USER_MATCH_REPORT;
const WIN_LOSE_MATCH_BUCKET_ID = VARIABLE.BUCKET.WIN_LOSE_MATCH;
const ANSWER_TO_QUESTION_REPORT_BUCKET = VARIABLE.BUCKET.ANSWER_TO_QUESTION_REPORT;
const PLAY_COUNT_LOG_BUCKET = VARIABLE.BUCKET.PLAY_COUNT_LOG;
const MANUALLY_REWARD_BUCKET = VARIABLE.BUCKET.MANUALLY_REWARD;
const RETRY_REPORT_BUCKET = VARIABLE.BUCKET.RETRY_REPORT;
const REWARD_REPORT_BUCKET = VARIABLE.BUCKET.REWARD_REPORT;
const BUGGED_REWARD_BUCKET = VARIABLE.BUCKET.BUGGED_REWARD;

const OFFER_ID_1GB = VARIABLE.TCELL.OFFER_ID_1GB;
const CHARGE_AMOUNT = VARIABLE.TCELL.CHARGE_AMOUNT;

export async function executeReportDaily() {
    let date = new Date().setDate(new Date().getDate() - 1)
    let dateFrom = new Date(date).setHours(0, 0, 0);
    let dateTo = new Date(date).setHours(23, 59, 59);

    await questionReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 1", err));
    await userReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 4", err));
    await playedMatchCount(0, dateFrom, dateTo).catch(err => console.log("ERROR: 49", err));
    await matchReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 2", err));
    await matchWinLoseCount(0, dateFrom, dateTo).catch(err => console.log("ERROR: 55", err));
    await chargeReportExport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 3", err));
    await retryReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: ", err));
    await getFailedRewards(0, dateFrom, dateTo).catch(err => console.log("ERROR: ", err));

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

export async function questionReport(reportType, dateFrom, dateTo) {
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

    if (!pastDuels.length) {
        return
    }

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

export async function matchReport(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    const reportDate = new Date().setDate(new Date().getDate() - 1)

    let p2pMatchPointsEarned = 0,
        p2mMatchPointsEarned = 0,
        daily_reward_earned = 0;

    const matches = await Api.getMany(PAST_MATCH_BUCKET, {
        end_time: {
            $gte: dateFrom,
            $lt: dateTo
        }
    })

    const p2pMatches = matches.filter(el => el.player_type == 0)
    const p2mMatches = matches.filter(el => el.player_type == 1)

    p2pMatches.forEach(match => {
        if (match.winner == 1 || match.winner == 2) {
            daily_reward_earned += 3
        } else if (match.winner == 3) {
            daily_reward_earned += 4
        }
        p2pMatchPointsEarned += match.points_earned;
    });

    p2mMatches.forEach(match => {
        if (match.winner == 1 || match.winner == 3) {
            daily_reward_earned += 2
        }
        p2mMatchPointsEarned += match.points_earned;
    });

    const rewardDaily = await Api.getMany(REWARD_LOG_BUCKET, {
        offer_id: OFFER_ID_1GB,
        date: {
            $gte: dateFrom,
            $lt: dateTo
        }
    })
    const rewardDailyTrue = rewardDaily.filter(el => el.status)
    const rewardDailyFalse = rewardDaily.filter(el => !el.status)
    const rewardDailyMatchTrue = rewardDailyTrue.filter(el => el.type == 'match')
    const rewardDailyChargeTrue = rewardDailyTrue.filter(el => el.type == 'charge')

    await Api.insertOne(MATCH_REPORT_BUCKET, {
        date: new Date(reportDate),
        p2p_play: p2pMatches.length,
        p2p_play_points_earned: p2pMatchPointsEarned,
        p2m_play: p2mMatches.length,
        p2m_play_points_earned: p2mMatchPointsEarned,
        daily_match_reward: rewardDailyMatchTrue.length,
        daily_charge_reward: rewardDailyChargeTrue.length,
        daily_reward_true: rewardDailyTrue.length,
        daily_reward_false: rewardDailyFalse.length,
        daily_reward_earned: daily_reward_earned,
        report_type: reportType
    })

    return true;
}

export async function chargeReportExport(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    const reportDate = new Date().setDate(new Date().getDate() - 1)

    let missingPlayCount = 0;

    const playCounts = await Api.getMany(PLAY_COUNT_LOG_BUCKET, {
        created_at: { $gte: dateFrom, $lt: dateTo }
    })

    playCounts.forEach(el => {
        el.added_play_count.forEach(playCounts => {
            missingPlayCount += playCounts.missing_play_count
        })
    })

    const chargesSuccessful = await Api.getMany(CHARGE_LOG_BUCKET, {
        date: { $gte: dateFrom, $lt: dateTo }, status: true
    })

    let totalQuantity = chargesSuccessful.length;

    const errorsMsgArr = [
        "CONSENT_DENIED",
        "F01, DIAMETER_END_USER_SERVICE_DENIED",
        "F01, SUBSCRIBER_NOT_FOUND",
    ]

    const errors = await Api.getMany(CHARGE_LOG_BUCKET, {
        date: { $gte: dateFrom, $lt: dateTo },
        status: false
    })

    const errorsLengthArr = []

    errorsMsgArr.forEach(errMsg => {
        const temptArr = errors.filter(err => err.user_text == errMsg);
        errorsLengthArr.push({
            msg: errMsg,
            quantity: temptArr.length
        })
        totalQuantity += temptArr.length;
    })

    const existsFalse = await Api.getMany(CHARGE_LOG_BUCKET, {
        date: { $gte: dateFrom, $lt: dateTo },
        status: false,
        user_text: { "$exists": false }
    })
    totalQuantity += existsFalse.length;

    const data = [
        {
            date: new Date(reportDate),
            charge_amount: CHARGE_AMOUNT,
            quantity: chargesSuccessful.length,
            ratio: chargesSuccessful.length ? Number(((chargesSuccessful.length / totalQuantity) * 100).toFixed(2)) : 0,
            status: "Başarılı",
            play_count: chargesSuccessful.length - missingPlayCount,
            error: "-",
            report_type: reportType
        }
    ];

    errorsLengthArr.forEach(err => {
        data.push({
            date: new Date(reportDate),
            charge_amount: CHARGE_AMOUNT,
            quantity: err.quantity,
            ratio: err.quantity ? Number(((err.quantity / totalQuantity) * 100).toFixed(2)) : 0,
            status: "Başarısız",
            play_count: "-",
            error: err.msg,
            report_type: reportType
        })
    })

    data.push({
        date: new Date(reportDate),
        charge_amount: CHARGE_AMOUNT,
        quantity: existsFalse.length,
        ratio: existsFalse.length ? Number(((existsFalse.length / totalQuantity) * 100).toFixed(2)) : 0,
        status: "Başarısız",
        play_count: "-",
        error: "Onay ve Red butonlara basmayan kullanıcılar",
        report_type: reportType
    })

    await Api.insertMany(CHARGE_REPORT_BUCKET, data)

    return true;
}

export async function userReport(reportType, dateFrom, dateTo) {
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

async function playedMatchCount(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    const reportDate = new Date().setDate(new Date().getDate() - 1)

    const db = await Api.useDatabase();
    const pastMatchesCollection = db.collection(`bucket_${PAST_MATCH_BUCKET}`);

    const endTimeFilter = { end_time: { $gte: dateFrom, $lt: dateTo } };

    const groupUsrer1 = { $group: { _id: "$user1" } };
    const groupUsrer2 = { $group: { _id: "$user2" } };

    let user1Paid = await pastMatchesCollection
        .aggregate([
            { $match: { ...endTimeFilter, user1_is_free: false } },
            { ...groupUsrer1 }
        ])
        .toArray()
        .catch(err => console.log("ERROR 39", err));

    let user2Paid = await pastMatchesCollection
        .aggregate([
            {
                $match: {
                    ...endTimeFilter,
                    player_type: 0,
                    user2_is_free: false
                }
            },
            { ...groupUsrer2 }
        ])
        .toArray()
        .catch(err => console.log("ERROR 40", err));

    let user1Free = await pastMatchesCollection
        .aggregate([
            { $match: { ...endTimeFilter, user1_is_free: true } },
            { ...groupUsrer1 }
        ])
        .toArray()
        .catch(err => console.log("ERROR 41", err));

    let user2Free = await pastMatchesCollection
        .aggregate([
            {
                $match: {
                    ...endTimeFilter,
                    player_type: 0,
                    user2_is_free: true
                }
            },
            { $group: { _id: "$user2" } }
        ])
        .toArray()
        .catch(err => console.log("ERROR 42", err));


    const paidvsPaidP2P = await Api.getCountByFilter(PAST_MATCH_BUCKET, {
        player_type: 0,
        user1_is_free: false,
        user2_is_free: false,
        ...endTimeFilter,
    })

    const freevsPaidP2P = await Api.getCountByFilter(PAST_MATCH_BUCKET, {
        player_type: 0,
        $or: [
            { user1_is_free: false, user2_is_free: true },
            { user1_is_free: true, user2_is_free: false }
        ],
        ...endTimeFilter
    })

    const paidvsBot = await Api.getCountByFilter(PAST_MATCH_BUCKET, {
        player_type: 1,
        user1_is_free: false,
        ...endTimeFilter
    })

    const freevsFreeP2P = await Api.getCountByFilter(PAST_MATCH_BUCKET, {
        player_type: 0,
        user1_is_free: true,
        user2_is_free: true,
        ...endTimeFilter
    })

    const freevsBot = await Api.getCountByFilter(PAST_MATCH_BUCKET, {
        player_type: 1,
        user1_is_free: true,
        ...endTimeFilter
    })

    user1Paid = user1Paid.map(el => el._id);
    user2Paid = user2Paid.map(el => el._id);
    user1Free = user1Free.map(el => el._id);
    user2Free = user2Free.map(el => el._id);

    let paid = [...new Set([...user1Paid, ...user2Paid])];
    let free = [...new Set([...user1Free, ...user2Free])];

    await Api.insertOne(USER_MATCH_REPORT_BUCKET, {
        date: new Date(reportDate),
        paid_player: paid.length,
        free_player: free.length,
        paid_play_total: paidvsPaidP2P * 2 + freevsPaidP2P + paidvsBot,
        free_play_total: freevsFreeP2P * 2 + freevsPaidP2P + freevsBot,
        report_type: reportType
    })

    return true;
}

async function matchWinLoseCount(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);

    const reportDate = new Date().setDate(new Date().getDate() - 1)
    const endTimeFilter = { end_time: { $gte: dateFrom, $lt: dateTo } };

    const freeWin = await Api.getCountByFilter(PAST_MATCH_BUCKET, {
        ...endTimeFilter,
        $or: [
            { user1_is_free: true, winner: 1 },
            { user2_is_free: true, winner: 2, player_type: 0 }
        ]
    })

    const freeLose = await Api.getCountByFilter(PAST_MATCH_BUCKET, {
        ...endTimeFilter,
        $or: [
            { user1_is_free: true, winner: 2 },
            { user2_is_free: true, winner: 1, player_type: 0 }
        ]
    })

    const freeEqual = await Api.getCountByFilter(PAST_MATCH_BUCKET, {
        ...endTimeFilter,
        $or: [
            { user1_is_free: true, winner: 3 },
            { user2_is_free: true, winner: 3, player_type: 0 }
        ]
    })

    const paidWin = await Api.getCountByFilter(PAST_MATCH_BUCKET, {
        ...endTimeFilter,
        $or: [
            { user1_is_free: false, winner: 1 },
            { user2_is_free: false, winner: 2, player_type: 0 }
        ]
    })


    const paidLose = await Api.getCountByFilter(PAST_MATCH_BUCKET, {
        ...endTimeFilter,
        $or: [
            { user1_is_free: false, winner: 2 },
            { user2_is_free: false, winner: 1, player_type: 0 }
        ]
    })

    const paidEqual = await Api.getCountByFilter(PAST_MATCH_BUCKET, {
        ...endTimeFilter,
        $or: [
            { user1_is_free: false, winner: 3 },
            { user2_is_free: false, winner: 3, player_type: 0 }
        ]
    })

    await Api.insertOne(WIN_LOSE_MATCH_BUCKET_ID, {
        date: new Date(reportDate),
        win_paid: paidWin,
        win_free: freeWin,
        lose_paid: paidLose,
        lose_free: freeLose,
        equal_paid: paidEqual,
        equal_free: freeEqual,
        win_total: paidWin + freeWin,
        lose_total: paidLose + freeLose,
        report_type: reportType
    })

    return true;
}

export async function retryReport(reportType, dateFrom, dateTo) {
    let dateFilter = {
        $gte: new Date(dateFrom),
        $lt: new Date(dateTo)
    };
    const reportDate = new Date().setDate(new Date().getDate() - 1)

    let hourly_retry_false = 0,
        hourly_retry_true = 0,
        daily_retry_false = 0,
        daily_retry_true = 0;

    const manualRewards = await Api.getMany(MANUALLY_REWARD_BUCKET, {
        created_at: dateFilter,
        system: true
    })

    manualRewards.forEach(reward => {
        if (reward.reward == 'hourly_1') {
            if (reward.process_completed)
                hourly_retry_true += 1
            else hourly_retry_false += 1
        } else {
            if (reward.process_completed)
                daily_retry_true += 1
            else daily_retry_false += 1
        }
    })

    await Api.insertOne(RETRY_REPORT_BUCKET, {
        hourly_retry_false,
        hourly_retry_true,
        daily_retry_false,
        daily_retry_true,
        date: new Date(reportDate),
        report_type: reportType
    })

    return true;
}

export async function getFailedRewards(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    const reportDate = new Date().setDate(new Date().getDate() - 1)

    const db = await Api.useDatabase();
    const rewardLogsCollection = db.collection(`bucket_${BUGGED_REWARD_BUCKET}`);

    let rewardHourlyFalse = await rewardLogsCollection
        .aggregate([
            {
                $match: {
                    status: false,
                    date: {
                        $gte: dateFrom,
                        $lt: dateTo
                    }
                }
            },
            { $group: { _id: "$user_text", count: { $sum: 1 } } }
        ])
        .toArray();

    let totalReward = 0;
    for (let reward of rewardHourlyFalse) {
        totalReward += reward.count;
    }

    const promises = [];
    for (let reward of rewardHourlyFalse) {
        let data = {
            date: new Date(reportDate),
            count: reward.count,
            ratio: reward.count ? Number(((reward.count / totalReward) * 100).toFixed(2)) : 0,
            error_text: reward._id,
            report_type: reportType
        }
        promises.push(Api.insertOne(REWARD_REPORT_BUCKET, data))
    }

    await Promise.all(promises);
    return true
}

export async function reportExportSend(title, reportType) {
    const Bucket = Api.useBucket();
    await Bucket.data
        .insert(MAILER_BUCKET, {
            title: title,
            template: "report-mail",
            variables: `{"title": "${title}"}`,
            emails: [
                "pinar.koca@turkcell.com.tr",
                "ozkan.hakan@turkcell.com.tr",
                "serdar@polyhagency.com",
                "idriskaribov@gmail.com",
            ],
            report_type: reportType
        })
        .catch(err => console.log("ERROR: 35", err));
    return true;
}

export async function executeReportDailyMan(req, res) {
    let date = new Date().setDate(new Date().getDate() - 1)
    let dateFrom = new Date(date).setHours(0, 0, 0);
    let dateTo = new Date(date).setHours(23, 59, 59);

    // await questionReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 1", err));
    // await userReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 4", err));
    // await playedMatchCount(0, dateFrom, dateTo).catch(err => console.log("ERROR: 49", err));
    // await matchReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 2", err));
    // await matchWinLoseCount(0, dateFrom, dateTo).catch(err => console.log("ERROR: 55", err));
    // await chargeReportExport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 3", err));
    // await retryReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: ", err));
    // await getFailedRewards(0, dateFrom, dateTo).catch(err => console.log("ERROR: ", err));

    // await reportExportSend("Günlük Rapor", 0).catch(err => console.log("ERROR: 5", err));

    return res.status(200).send({ message: 'Ok' });
}