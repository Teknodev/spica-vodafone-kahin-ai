import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const nodemailer = require("nodemailer");

const nodeMailerUser = VARIABLE.MAILER.SMTP_USER || null;
const nodeMailerHost = VARIABLE.MAILER.SMTP_HOST || null;
const nodeMailerPassword = VARIABLE.MAILER.SMTP_PASSWORD || null;
const mailFrom = VARIABLE.MAILER.MAIL_FROM || null;

const MATCH_REPORT_BUCKET = VARIABLE.BUCKET.MATCH_REPORT;
const USER_REPORT_BUCKET = VARIABLE.BUCKET.USER_REPORT;
const ANSWER_TO_QUESTION_REPORT_BUCKET = VARIABLE.BUCKET.ANSWER_TO_QUESTION_REPORT;
const REWARD_REPORT_BUCKET = VARIABLE.BUCKET.REWARD_REPORT;
const REWARD_MAILER = VARIABLE.BUCKET.MAILER;
const SUBSCRIPTION_REPORT_BUCKET = VARIABLE.BUCKET.SUBSCRIPTION_REPORT;
const CHARGE_VALUE = 96;

/*
    REPORT TYPES: 
        0 - Günlük Raport
        1 - Haftalık Rapor
        11 - Haftalık (Gün Bazlı) Rapor
        2 - Aylık Rapor
        22 - Aylık (Gün Bazlı) Rapor
*/

export default async function (change) {
    let buckets = {
        templates: REWARD_MAILER
    };

    const Bucket = Api.useBucket();
    let template = await Bucket.data
        .getAll(buckets.templates, {
            queryParams: { filter: `template=='${change.current.template}'` }
        })
        .catch(err => console.log("ERROR 42", err));
    template = template[0];

    let variables = JSON.parse(change.current.variables);
    let emails = change.current.emails;
    let reportType = change.current.report_type;

    const html = await getData(reportType).catch(err => console.log("ERROR 9", err));

    if (emails.length) {
        for (let email of emails) {
            _sendEmail(variables, email, template.subject, html);
        }
    }
}

function _sendEmail(variables, email, subject, html) {
    if (nodeMailerHost && nodeMailerUser && nodeMailerPassword && mailFrom) {
        var transporter = nodemailer.createTransport({
            direct: true,
            host: nodeMailerHost,
            port: 465,
            auth: {
                user: nodeMailerUser,
                pass: nodeMailerPassword
            },
            secure: true
        });

        var mailOptions = {
            from: mailFrom,
            to: email,
            subject: 'Sayi Krali Report',
            html:
                "<html><head><meta http-equiv='Content-Type' content='text/plain'></head><body><table><tr><td>" +
                `<h3>${variables.title}</h3> ${html}` +
                "</td></tr></table></body></html>"
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log("Email sent: " + info.response);
            }
        });
    } else {
        console.log("Please set your all ENVIRONMENT VARIABLES");
        return null;
    }
}

async function getData(reportType) {
    let date = new Date();
    if (reportType == 0) {
        date.setHours(date.getHours() - 26);
    } else if (reportType == 11 || reportType == 1) {
        date.setDate(date.getDate() - 7);
        date.setHours(date.getHours() - 6);
    } else if (reportType == 22 || reportType == 2) {
        date.setMonth(date.getMonth() - 1);
        date.setHours(date.getHours() - 5);
    } else {
        return true;
    }

    let dateFilter = {
        $gte: new Date(date),
        $lte: new Date()
    }

    const usersHtml = await usersReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 27", err)
    );
    const matchGeneralHtml = await matchGeneralReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 24", err)
    );
    // const rewardHtml = await rewardReport(reportType, dateFilter).catch(err =>
    //     console.log("ERROR 25", err)
    // );
    const subscriptionHtml = await subscriptionReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 26", err)
    );
    const questionsHtml = await questionsReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 27", err)
    );
    const revenueHtml = await revenueReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 28", err)
    );

    let html =
        usersHtml +
        "<br/><br/>" +
        matchGeneralHtml +
        "<br/><br/>" +
        // rewardHtml +
        // "<br/><br/>" +
        subscriptionHtml +
        "<br/><br/>" +
        revenueHtml +
        "<br/><br/>" +
        questionsHtml;


    return html;
}



async function usersReport(reportType, dateFilter) {
    let defaultReportType;
    if (reportType == 1 || reportType == 11 || reportType == 22 || reportType == 2) {
        defaultReportType = reportType;
        reportType = 0;
    }

    const db = await Api.useDatabase();
    const usersCollection = db.collection(`bucket_${USER_REPORT_BUCKET}`);

    let usersData = await usersCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 41", e);
            return res.status(400).send({ message: e });
        });



    if (defaultReportType == 2 || defaultReportType == 1) {
        let currentDate = new Date();
        let totalUser = 0;
        let totalNewUser = 0;
        usersData.forEach(data => {
            totalUser = data.total_user;
            totalNewUser += data.new_user;
        });
        usersData = [
            {
                date: currentDate.setDate(currentDate.getDate() - 1),
                total_user: totalUser,
                new_user: totalNewUser
            }
        ];
    }

    let tableBody = "";
    usersData.forEach(data => {
        tableBody += `
            <tr>
             <td style="width: 33.3%;">${new Date(data.date).toLocaleDateString()}</td>
             <td style="width: 33.3%;">${numberWithDot(data.total_user)}</td>
             <td style="width: 33.3%;">${numberWithDot(data.new_user)}</td>
            </tr>`;
    });

    let userHtml = `
        <h4>Kullanıcı Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 33.3%; text-align:left">Tarih</th>
            <th style="width: 33.3%; text-align:left">Toplam Kullanıcı</th>
            <th style="width: 33.3%; text-align:left">Yeni Kullanıcı</th>
            </tr>
           ${tableBody}
            </tbody>
        </table>`;

    return userHtml;
}

async function matchGeneralReport(reportType, dateFilter) {
    let htmlType = 0;
    let defaultReportType = reportType;

    if (reportType == 11) {
        htmlType = 11;
    }
    if (reportType == 22) {
        htmlType = 22;
    }
    reportType = 0;

    const db = await Api.useDatabase();
    const matchCollection = db.collection(`bucket_${MATCH_REPORT_BUCKET}`);

    let matchData = await matchCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 38", e);
            return res.status(400).send({ message: e });
        });


    if (defaultReportType == 1 || defaultReportType == 2) {
        let p2pPlay = 0;
        let p2pPlayPointsEarned = 0;
        let p2mPlay = 0;
        let p2mPlayPointsEarned = 0;
        let player = 0;
        let play = 0;

        matchData.forEach(data => {
            p2pPlay += data.p2p_play;
            p2pPlayPointsEarned += data.p2p_play_points_earned;
            p2mPlay += data.p2m_play;
            p2mPlayPointsEarned += data.p2m_play_points_earned;
            player += data.player;
            play += data.play;
        });
        matchData = [
            {
                p2p_play: p2pPlay,
                p2p_play_points_earned: p2pPlayPointsEarned,
                p2m_play: p2mPlay,
                p2m_play_points_earned: p2mPlayPointsEarned,
                player: player,
                play: play,
            }
        ];
    }

    let html;
    if (htmlType == 11 || htmlType == 22) {
        let tableBody = "";
        matchData.forEach(data => {
            tableBody += `
            <tr>
             <td style="width: 11.1%;">${new Date(data.date).toLocaleDateString()}</td>
             <td style="width: 11.1%;">${numberWithDot(data.p2p_play)}</td>
             <td style="width: 11.1%;">${numberWithDot(data.p2p_play_points_earned)}</td>
             <td style="width: 11.1%;">${numberWithDot(data.p2p_play_points)}</td>
             <td style="width: 11.1%;">${numberWithDot(data.p2m_play)}</td>
             <td style="width: 11.1%;">${numberWithDot(data.p2m_play_points_earned)}</td>
             <td style="width: 11.1%;">${numberWithDot(data.p2m_play_points)}</td>
             <td style="width: 11.1%;">${numberWithDot(data.player)}</td>
             <td style="width: 11.1%;">${numberWithDot(data.play)}</td>
            </tr>`;
        });
        html = `
        <h4>Oyun Raporu</h4>
         <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 11.1%; text-align:left">Tarih</th>
            <th style="width: 11.1%; text-align:left">P2P Oyun</th>
            <th style="width: 11.1%; text-align:left">P2P Kazanılan Puan</th>
            <th style="width: 11.1%; text-align:left">P2P Maç Sonu Puan</th>
            <th style="width: 11.1%; text-align:left">P2M Oyun</th>
            <th style="width: 11.1%; text-align:left">P2M Kazanılan Puan</th>
            <th style="width: 11.1%; text-align:left">P2M Maç Sonu Puan</th>
            <th style="width: 11.1%; text-align:left">Oynayan Kullanıcı</th>
            <th style="width: 11.1%; text-align:left">Toplam Oyun</th>
            </tr>
           ${tableBody}
            </tbody>
        </table>`;
    } else {
        html = `
        <h4>Oyun Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
             <tr>
                <td style="width: 16.6%;"></td>
                <td style="width: 16.6%; font-weight: bold;">Oyun Sayısı</td>
                <td style="width: 16.6%; font-weight: bold;">Kazanılan Puan</td>
                <td style="width: 16.6%; font-weight: bold;">Maç Sonu Puan</td>
                <td style="width: 16.6%; font-weight: bold;">Oynayan Kullanıcı</td>
                <td style="width: 16.6%; font-weight: bold;">Toplam Oyun</td>
            </tr>
             <tr>
                <td style="width: 16.6%; font-weight: bold;">P2P</td>
                <td style="width: 16.6%;">${numberWithDot(matchData[0].p2p_play)}</td>
                <td style="width: 16.6%;">${numberWithDot(matchData[0].p2p_play_points_earned)}</td>
                <td style="width: 16.6%;">${numberWithDot(matchData[0].p2p_play_points_earned)}</td>
                <td style="width: 16.6%;">-</td>
                <td style="width: 16.6%;">-</td>
            </tr>
             <tr>
                <td style="width: 16.6%; font-weight: bold;">P2M</td>
                <td style="width: 16.6%;">${numberWithDot(matchData[0].p2m_play)}</td>
                <td style="width: 16.6%;">${numberWithDot(matchData[0].p2m_play_points_earned)}</td>
                <td style="width: 16.6%;">${numberWithDot(matchData[0].p2m_play_points_earned)}</td>
                <td style="width: 16.6%;">-</td>
                <td style="width: 16.6%;">-</td>
            </tr>
            <tr>
                <td style="width: 16.6%; font-weight: bold;">Toplam</td>
                <td style="width: 16.6%;">${numberWithDot(matchData[0].p2p_play + matchData[0].p2m_play)}</td>
                <td style="width: 16.6%;">${numberWithDot(matchData[0].p2p_play_points_earned +
            matchData[0].p2m_play_points_earned)}</td>
             <td style="width: 20%;">${numberWithDot(matchData[0].p2p_play_points_earned +
                matchData[0].p2m_play_points_earned)}</td>
                <td style="width: 16.6%;">${numberWithDot(matchData[0].player || 0)}</td>
                <td style="width: 16.6%;">${numberWithDot(matchData[0].play || 0)}</td>
            </tr>
            </tbody>
        </table>`;
    }

    return html;
}

async function rewardReport(reportType, dateFilter) {
    let defaultReportType;
    if (reportType == 1 || reportType == 11 || reportType == 22 || reportType == 2) {
        defaultReportType = reportType;
        reportType = 0;
    }

    const db = await Api.useDatabase();
    const rewardCollection = db.collection(`bucket_${REWARD_REPORT_BUCKET}`);

    let rewardData = await rewardCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 47", e);
            return res.status(400).send({ message: e });
        });
    console.log("rewardData before: ", rewardData)
    if (defaultReportType == 1 || defaultReportType == 2) {
        let result = [];
        rewardData.reduce(function (res, value) {
            if (!res[value.status_code]) {
                res[value.status_code] = {
                    count: 0,
                    status_code: value.status_code
                };
                result.push(res[value.status_code]);
            }
            res[value.status_code].count += value.count;
            return res;
        }, {});
        rewardData = result;
        console.log("rewardData after: ", rewardData)
    }

    let rewardBody = "";
    let chargeTotal = 0;
    let pointsTotal = 0;
    let lastDate = "";

    rewardData.forEach((reward, index) => {
        chargeTotal += reward.charge;
        pointsTotal += reward.points;
    })
    rewardData.forEach((reward, index) => {
        let date = reward.date;
        console.log("reward: ", reward);
        if (defaultReportType == 1 || defaultReportType == 2) {
            let now = new Date();
            date = now.setDate(now.getDate() - 1);
        }

        if (lastDate && lastDate != new Date(date).toDateString()) {
            rewardBody += `
                <tr>
                    <td style="width: 10%;">---</td>
                    <td style="width: 10%;">---</td>
                    <td style="width: 10%;">---</td>
                    <td style="width: 10%;">---</td>
                    <td style="width: 10%;">---</td>
                    <td style="width: 50%;">---</td>
                </tr>`
        }

        let ratioCharge = defaultReportType == 1 ? reward.charge == 0 ? 0 : ((reward.charge / chargeTotal) * 100).toFixed(2) : reward.charge_ratio;
        let ratioPoints = defaultReportType == 1 ? reward.points == 0 ? 0 : ((reward.points / pointsTotal) * 100).toFixed(2) : reward.points_ratio;
        //reward.charge undefined 
        rewardBody += `<tr>
                    <td style="width: 10%;">${new Date(date).toLocaleDateString()}</td>
                    <td style="width: 10%;">${numberWithDot(reward.charge)}</td>
                    <td style="width: 10%;">${ratioCharge}</td>
                    <td style="width: 10%;">${numberWithDot(reward.points)}</td>
                    <td style="width: 10%;">${ratioPoints}</td>
                    <td style="width: 50%;">${STATUS_CODE[reward.status_code]}</td>
                    </tr>
                    `;

        lastDate = new Date(date).toDateString();
    });

    let rewardHtml = `
        <h4>Reward Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 10%; text-align:left">Tarih</th>
            <th style="width: 10%; text-align:left">Adet (Charge)</th>
            <th style="width: 10%; text-align:left">Oran (Charge)</th>
            <th style="width: 10%; text-align:left">Adet (Puan)</th>
            <th style="width: 10%; text-align:left">Oran (Puan)</th>
            <th style="width: 50%; text-align:left">Detay</th>
            </tr>
            ${rewardBody}
             <tr>
            <th style="width: 10%; text-align:left">Toplam</th>
            <th style="width: 10%; text-align:left">${numberWithDot(chargeTotal)}</th>
            <th style="width: 10%; text-align:left">-</th>
            <th style="width: 10%; text-align:left">${numberWithDot(pointsTotal)}</th>
            <th style="width: 10%; text-align:left">-</th>
            <th style="width: 50%; text-align:left">-</th>
            </tr>
            </tbody>
        </table>`;

    return rewardHtml;
}
async function revenueReport(reportType, dateFilter) {
    let defaultReportType;
    let subscriptionCreated = 0;
    let refunded = 0;
    const date = new Date().setDate(new Date().getDate() - 1);
    //1-2 TOPLAM 11-22 gün bazlı

    if (reportType == 1 || reportType == 11 || reportType == 22 || reportType == 2) {
        defaultReportType = reportType;
        reportType = 0;
    }

    const db = await Api.useDatabase();
    const subscriptionCollection = db.collection(`bucket_${SUBSCRIPTION_REPORT_BUCKET}`);

    try {
        const subscriptionData = await subscriptionCollection
            .find({ report_type: reportType, date: dateFilter })
            .toArray();

        if (defaultReportType == 1 || defaultReportType == 2) {
            subscriptionData.forEach(data => {
                subscriptionCreated += data.subscription_created || 0;
                refunded += data.refunded || 0;

            });
            const revenue = (subscriptionCreated - refunded) * CHARGE_VALUE;
            let tableBody = "";
            tableBody += `
                <tr>
                    <td style="width: 25%;">${new Date(date).toLocaleDateString()}</td>
                    <td style="width: 25%;">${numberWithDot(subscriptionCreated)}</td>
                    <td style="width: 25%;">${numberWithDot(refunded)}</td>
                    <td style="width: 25%;">${CHARGE_VALUE}TL</td>
                    <td style="width: 25%;">${numberWithDot(revenue)}TL</td>
                </tr>`;

            let revenueHtml = `
            <h4>Revenue Report</h4>
            <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                <tr>
                    <th style="width: 25%; text-align:left">Tarih</th>
                    <th style="width: 25%; text-align:left">Yeni abone sayısı</th>
                    <th style="width: 25%; text-align:left">İade edilen abonelik sayısı</th>
                    <th style="width: 25%; text-align:left">Charge değeri</th>
                    <th style="width: 25%; text-align:left">Toplam gelir</th>
                </tr>
                ${tableBody}
                </tbody>
            </table>`;
            return revenueHtml;
        } else {
            let tableBody = "";
            subscriptionData.forEach(data => {
                const revenue = (data.subscription_created - data.refunded) * CHARGE_VALUE;
                tableBody += `
                <tr>
                    <td style="width: 25%;">${new Date(data.date).toLocaleDateString()}</td>
                    <td style="width: 25%;">${numberWithDot(data.subscription_created)}</td>
                    <td style="width: 25%;">${numberWithDot(data.refunded)}</td>
                    <td style="width: 25%;">${CHARGE_VALUE}TL</td>
                    <td style="width: 25%;">${numberWithDot(revenue)}TL</td>
                </tr>`;
            });
            let revenueHtml = `
                <h4>Revenue Report</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                    <tr>
                        <th style="width: 25%; text-align:left">Tarih</th>
                        <th style="width: 25%; text-align:left">Yeni abone sayısı</th>
                        <th style="width: 25%; text-align:left">İade edilen abonelik sayısı</th>
                        <th style="width: 25%; text-align:left">Charge değeri</th>
                        <th style="width: 25%; text-align:left">Toplam gelir</th>
                    </tr>
                    ${tableBody}
                    </tbody>
                </table>`;
            return revenueHtml;
        }

    } catch (e) {
        console.log("ERROR 99", e);
        return res.status(400).send({ message: e });
    }
}


async function subscriptionReport(reportType, dateFilter) {
    let defaultReportType;
    if (reportType == 1 || reportType == 11 || reportType == 22 || reportType == 2) {
        defaultReportType = reportType;
        reportType = 0;
    }

    const db = await Api.useDatabase();
    const subscriptionCollection = db.collection(`bucket_${SUBSCRIPTION_REPORT_BUCKET}`);

    let subscriptionData = await subscriptionCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 47", e);
            return res.status(400).send({ message: e });
        });

    if (defaultReportType == 2 || defaultReportType == 1) {
        let currentDate = new Date();
        let subscriptionCreated = 0;
        let createSubscriptionFailed = 0;
        let subscriptionSuspended = 0;
        let subscriptionResumed = 0;
        let subscriptionWillBeDeactivated = 0;
        let subscriptionDeactivated = 0;
        let subscriptionDeactivationFailed = 0;
        let refunded = 0;

        subscriptionData.forEach(data => {
            subscriptionCreated = data.subscription_created;
            createSubscriptionFailed = data.create_subscription_failed;
            subscriptionSuspended = data.subscription_suspended;
            subscriptionResumed = data.subscription_resumed;
            subscriptionWillBeDeactivated = data.subscription_will_be_deactivated;
            subscriptionDeactivated = data.subscription_deactivated;
            subscriptionDeactivationFailed = data.subscription_deactivation_failed;
            refunded = data.refunded

        });
        subscriptionData = [
            {
                date: currentDate.setDate(currentDate.getDate() - 1),
                subscription_created: subscriptionCreated,
                create_subscription_failed: createSubscriptionFailed,
                subscription_suspended: subscriptionSuspended,
                subscription_resumed: subscriptionResumed,
                subscription_will_be_deactivated: subscriptionWillBeDeactivated,
                subscription_deactivated: subscriptionDeactivated,
                subscription_deactivation_failed: subscriptionDeactivationFailed,
                refunded: refunded
            }
        ];
    }

    let tableBody = "";
    subscriptionData.forEach(data => {
        tableBody += `
            <tr>
             <td style="width: 12.8%;">${new Date(data.date).toLocaleDateString()}</td>
             <td style="width: 12.8%;">${numberWithDot(data.subscription_created)}</td>
             <td style="width: 12.8%;">${numberWithDot(data.create_subscription_failed)}</td>
             <td style="width: 12.8%;">${numberWithDot(data.subscription_suspended)}</td>
             <td style="width: 12.8%;">${numberWithDot(data.subscription_resumed)}</td>
             <td style="width: 12.8%;">${numberWithDot(data.subscription_will_be_deactivated)}</td>
             <td style="width: 12.8%;">${numberWithDot(data.subscription_deactivated)}</td>
             <td style="width: 12.8%;">${numberWithDot(data.subscription_deactivation_failed)}</td>
             <td style="width: 12.8%;">${numberWithDot(data.refunded)}</td>
            </tr>`;
    });

    let subscriptionHtml = `
        <h4>Abonelik Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 11.1%; text-align:left">Tarih</th>
            <th style="width: 11.1%; text-align:left">Created</th>
            <th style="width: 11.1%; text-align:left">Created Failed</th>
            <th style="width: 11.1%; text-align:left">Suspended</th>
            <th style="width: 11.1%; text-align:left">Resumed</th>
            <th style="width: 11.1%; text-align:left">Will Be Deactivated</th>
            <th style="width: 11.1%; text-align:left">Deactivated</th>
            <th style="width: 11.1%; text-align:left">Deactivation Failed</th>
            <th style="width: 11.1%; text-align:left">Refunded</th>
            </tr>
           ${tableBody}
            </tbody>
        </table>`;

    return subscriptionHtml;

}

async function questionsReport(reportType, dateFilter) {
    let htmlType = 0;
    let defaultReportType = reportType;

    if (reportType == 11) {
        htmlType = 11;
    }
    if (reportType == 22) {
        htmlType = 22;
    }
    reportType = 0;

    const db = await Api.useDatabase();
    const answersToQuestionsCollection = db.collection(
        `bucket_${ANSWER_TO_QUESTION_REPORT_BUCKET}`
    );

    let answersData = await answersToQuestionsCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 45", e);
            return res.status(400).send({ message: e });
        });



    if (defaultReportType == 1 || defaultReportType == 2) {
        let currentDate = new Date();
        let correctAnswer_1 = 0;
        let correctAnswer_2 = 0;
        let correctAnswer_3 = 0;
        let wrongAnswer_1 = 0;
        let wrongAnswer_2 = 0;
        let wrongAnswer_3 = 0;

        answersData.forEach(data => {
            correctAnswer_1 += data.correct_answer_1;
            correctAnswer_2 += data.correct_answer_2;
            correctAnswer_3 += data.correct_answer_3;
            wrongAnswer_1 += data.wrong_answer_1;
            wrongAnswer_2 += data.wrong_answer_2;
            wrongAnswer_3 += data.wrong_answer_3;
        });
        answersData = [
            {
                date: currentDate.setDate(currentDate.getDate() - 1),
                correct_answer_1: correctAnswer_1,
                correct_answer_2: correctAnswer_2,
                correct_answer_3: correctAnswer_3,
                wrong_answer_1: wrongAnswer_1,
                wrong_answer_2: wrongAnswer_2,
                wrong_answer_3: wrongAnswer_3
            }
        ];
    }

    let answersHtml;
    if (reportType == 1 || reportType == 11 || reportType == 22 || reportType == 2) {
        let tableBody = "";
        answersData.forEach(data => {
            tableBody += `
            <tr>
             <td style="width: 14.2%;">${new Date(data.date).toLocaleDateString()}</td>
             <td style="width: 14.2%;">${data.correct_answer_1}</td>
             <td style="width: 14.2%;">${data.correct_answer_2}</td>
             <td style="width: 14.2%;">${data.correct_answer_3}</td>
             <td style="width: 14.2%;">${data.wrong_answer_1}</td>
             <td style="width: 14.2%;">${data.wrong_answer_2}</td>
             <td style="width: 14.2%;">${data.wrong_answer_3}</td>
            </tr>`;
        });
        answersHtml = `
        <h4>Sorular Raporu</h4>
         <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 14.2%; text-align:left">Tarih</th>
            <th style="width: 14.2%; text-align:left">Level 1 Doğru Cevap</th>
            <th style="width: 14.2%; text-align:left">Level 2 Doğru Cevap</th>
            <th style="width: 14.2%; text-align:left">Level 3 Doğru Cevap</th>
            <th style="width: 14.2%; text-align:left">Level 1 Yanlış Cevap</th>
            <th style="width: 14.2%; text-align:left">Level 2 Yanlış Cevap</th>
            <th style="width: 14.2%; text-align:left">Level 3 Yanlış Cevap</th>
            </tr>
           ${tableBody}
            </tbody>
        </table>`;
    } else {
        answersHtml = `
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 25%; text-align:left">Level</th>
            <th style="width: 25%; text-align:left">Toplam Cevap</th>
            <th style="width: 25%; text-align:left">Doğru Cevap</th>
            <th style="width: 25%; text-align:left">Yanlış Cevap</th>
            </tr>
           <tr>
                <td style="width: 25%;">1</td>
                <td style="width: 25%;">${numberWithDot(answersData[0].correct_answer_1 +
            answersData[0].wrong_answer_1)}</td>
                <td style="width: 25%;">${numberWithDot(answersData[0].correct_answer_1)}</td>
                <td style="width: 25%;">${numberWithDot(answersData[0].wrong_answer_1)}</td>
            </tr>
            <tr>
                <td style="width: 25%;">2</td>
                <td style="width: 25%;">${numberWithDot(answersData[0].correct_answer_2 +
                answersData[0].wrong_answer_2)}</td>
                <td style="width: 25%;">${numberWithDot(answersData[0].correct_answer_2)}</td>
                <td style="width: 25%;">${numberWithDot(answersData[0].wrong_answer_2)}</td>
            </tr>
            <tr>
                <td style="width: 25%;">3</td>
                <td style="width: 25%;">${numberWithDot(answersData[0].correct_answer_3 +
                    answersData[0].wrong_answer_3)}</td>
                <td style="width: 25%;">${numberWithDot(answersData[0].correct_answer_3)}</td>
                <td style="width: 25%;">${numberWithDot(answersData[0].wrong_answer_3)}</td>
            </tr>
            </tbody>
        </table>`;
    }


    let questionsHtml = `
        <h4>Sorular Raporu</h4>
        ${answersHtml}
        <br/>`;

    if (reportType == 1 || reportType == 11 || reportType == 22 || reportType == 2) {
        return answersHtml;
    } else return questionsHtml;
}

function numberWithDot(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const STATUS_CODE = {
    0: "Başarılı",
    1: "MMA zaten mevcut",
    2: "Sistem hatası. (Daha sonra tekrar deneyiniz)",
    3: "MMA Aktif değil",
    4: "Tanımlı MMA bulunamadı",
    5: "Geçersiz abone",
    6: "Paket tanımı bulunamadı",
    7: "MMA hesabı bulunamadı",
    8: "Geçersiz Promosyon",
    9: "Eksik parametre",
    10: "Hatalı Voucher",
    11: "Hatalı hediye tanımı",
    12: "Hediye değişim oranı bulunamadı",
    13: "Tanımlı hediye bulunamadı",
    14: "Yetersiz kredi",
    15: "Hediye yüklerken hata",
    16: "Direct Load desteklenmiyor",
    17: "Predefined Load desteklenmiyor",
    18: "Voucher kontrolü desteklenmiyor",
    19: "Voucher kontrollü promosyon. Voucher bilgisi gönderilmeli",
    20: "Varsayılan hediye birimleri kullanılamaz",
    21: "Bu promosyona yetkiniz yoktur",
    22: "Promosyon hesap bilgisi bulunamadı",
    23: "Kullanılmış Voucher",
    24: "Hediye miktarı sıfır veya sıfırdan küçük verilemez",
    25: "Hediye geçiş tanımlarında hata",
    26: "Mükerrer işlem numarası (transaction id)",
    100: "Başarısız"
}