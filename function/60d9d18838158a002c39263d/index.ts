import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";

const nodemailer = require("nodemailer");

const nodeMailerUser = Environment.env.MAILER.SMTP_USER || null;
const nodeMailerHost = Environment.env.MAILER.SMTP_HOST || null;
const nodeMailerPassword = Environment.env.MAILER.SMTP_PASSWORD || null;
const mailFrom = Environment.env.MAILER.MAIL_FROM || null;

const MATCH_REPORT_BUCKET = Environment.env.BUCKET.MATCH_REPORT;
const CHARGE_REPORT_BUCKET = Environment.env.BUCKET.CHARGE_REPORT;
const USER_REPORT_BUCKET = Environment.env.BUCKET.USER_REPORT;
const USER_MATCH_REPORT_BUCKET = Environment.env.BUCKET.USER_MATCH_REPORT;
const WIN_LOSE_MATCH_BUCKET = Environment.env.BUCKET.WIN_LOSE_MATCH;
const ANSWER_TO_QUESTION_REPORT_BUCKET = Environment.env.BUCKET.ANSWER_TO_QUESTION_REPORT;
const RETRY_REPORT_BUCKET = Environment.env.BUCKET.RETRY_REPORT;
const REWARD_REPORT_BUCKET = Environment.env.BUCKET.REWARD_REPORT;

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
        templates: process.env.TEMPLATES_BUCKET_ID
    };

    const Bucket = Api.useBucket();
    let template = await Bucket.data
        .getAll(buckets.templates, {
            queryParams: { filter: `template=='${change.current.template}'` }
        })
        .catch(err => console.log("ERROR 42", err));
    template = template[0];

    let content = template.content;
    let variables = JSON.parse(change.current.variables);
    let emails = change.current.emails;
    let reportType = change.current.report_type;

    const html = await getData(reportType).catch(err => console.log("ERROR 9", err));

    // for (const [key, value] of Object.entries(variables)) {
    //     content = content.replace(new RegExp(`{{${key}}}`, "g"), value);
    // }
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
            subject: subject,
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
    const playedMatchHtml = await playedMatchCount(reportType, dateFilter).catch(err =>
        console.log("ERROR 23", err)
    );
    const matchGeneralHtml = await matchGeneralReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 24", err)
    );
    const matchWinLoseHtml = await matchWinLoseCount(reportType, dateFilter).catch(err =>
        console.log("ERROR 22", err)
    );
    const rewardHtml = await rewardReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 25", err)
    );
    const chargeHtml = await chargeReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 26", err)
    );
    const retryHtml = await retryReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 26", err)
    );
    const questionsHtml = await questionsReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 25", err)
    );

    let html =
        usersHtml +
        "<br/><br/>" +
        playedMatchHtml +
        "<br/><br/>" +
        matchGeneralHtml +
        "<br/><br/>" +
        matchWinLoseHtml +
        "<br/><br/>" +
        rewardHtml +
        "<br/><br/>" +
        chargeHtml +
        "<br/><br/>" +
        retryHtml +
        "<br/><br/>" +
        questionsHtml;


    return html;
}

async function matchWinLoseCount(reportType, dateFilter) {
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
    const winLoseCollection = db.collection(`bucket_${WIN_LOSE_MATCH_BUCKET}`);

    let winLoseData = await winLoseCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 44", e);
            return res.status(400).send({ message: e });
        });



    if (defaultReportType == 1 || defaultReportType == 2) {
        let winPaid = 0;
        let winFree = 0;
        let losePaid = 0;
        let loseFree = 0;
        let winTotal = 0;
        let loseTotal = 0;
        let equalPaid = 0;
        let equalFree = 0;

        winLoseData.forEach(data => {
            winPaid += data.win_paid;
            winFree += data.win_free;
            losePaid += data.lose_paid;
            loseFree += data.lose_free;
            winTotal += data.win_total;
            loseTotal += data.lose_total;
            equalPaid += data.equal_paid;
            equalFree += data.equal_paid;
        });
        winLoseData = [
            {
                win_paid: winPaid,
                win_free: winFree,
                lose_paid: losePaid,
                lose_free: loseFree,
                win_total: winTotal,
                lose_total: loseTotal,
                equal_paid: equalPaid,
                equal_free: equalFree
            }
        ];
    }

    let html;
    if (htmlType == 11 || htmlType == 22) {
        let tableBody = "";
        winLoseData.forEach(data => {
            tableBody += `
            <tr>
             <td style="width: 20%;">${new Date(data.date).toLocaleDateString()}</td>
             <td style="width: 20%;">${numberWithDot(data.win_paid)}</td>
             <td style="width: 20%;">${numberWithDot(data.win_free)}</td>
            <td style="width: 20%;">${numberWithDot(data.lose_paid)}</td>
             <td style="width: 20%;">${numberWithDot(data.lose_free)}</td>
            </tr>`;
        });
        html = `
        <h4>Kullanıcılar (Kazanılan/Kaybedilen) Maç Raporu</h4>
         <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 20%; text-align:left">Tarih</th>
            <th style="width: 20%; text-align:left">Ücretli Kazanılan Maç</th>
            <th style="width: 20%; text-align:left">Ücretsiz Kazanılan Maç</th>
            <th style="width: 20%; text-align:left">Ücretli Kaybedilen Maç</th>
            <th style="width: 20%; text-align:left">Ücretsiz Kaybedilen Maç</th>
            </tr>
           ${tableBody}
            </tbody>
        </table>`;
    } else {
        html = `
        <h4>Kullanıcılar (Kazanılan/Kaybedilen) Maç Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
                <tr>
                    <td style="width: 25%;"></td>
                    <td style="width: 25%; font-weight: bold;">Kazanılan Maç</td>
                    <td style="width: 25%; font-weight: bold;">Kaybedilen Maç</td>
                    <td style="width: 25%; font-weight: bold;">Berabere Maç</td>
                </tr>
                 <tr>
                    <td style="width: 25%; font-weight: bold;">Ücretli</td>
                    <td style="width: 25%;">${numberWithDot(winLoseData[0].win_paid)}</td>
                    <td style="width: 25%;">${numberWithDot(winLoseData[0].lose_paid)}</td>
                    <td style="width: 25%;">${numberWithDot(winLoseData[0].equal_paid)}</td>
                </tr>
                 <tr>
                    <td style="width: 25%; font-weight: bold;">Ücretsiz</td>
                    <td style="width: 25%;">${numberWithDot(winLoseData[0].win_free)}</td>
                    <td style="width: 25%;">${numberWithDot(winLoseData[0].lose_free)}</td>
                    <td style="width: 25%;">${numberWithDot(winLoseData[0].equal_free)}</td>
                </tr>
                 <tr>
                    <td style="width: 25%; font-weight: bold;">Toplam</td>
                    <td style="width: 25%;">${numberWithDot(winLoseData[0].win_total)}</td>
                    <td style="width: 25%;">${numberWithDot(winLoseData[0].lose_total)}</td>
                    <td style="width: 25%;">${numberWithDot(winLoseData[0].equal_paid + winLoseData[0].equal_free)}</td>
                </tr>
            </tbody>
        </table>`;
    }

    return html;
}

async function playedMatchCount(reportType, dateFilter) {
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
    const userMatchesCollection = db.collection(`bucket_${USER_MATCH_REPORT_BUCKET}`);

    let userMatches = await userMatchesCollection
        .find({ report_type: reportType, date: dateFilter }, { $sort: { _id: 1 } })
        .toArray()
        .catch(e => {
            console.log("ERROR 43", e);
            return res.status(400).send({ message: e });
        });



    if (defaultReportType == 1 || defaultReportType == 2) {
        let paidPlayer = 0;
        let freePlayer = 0;
        let paidPlayTotal = 0;
        let freePlayTotal = 0;

        userMatches.forEach(data => {
            paidPlayer += data.paid_player;
            freePlayer += data.free_player;
            paidPlayTotal += data.paid_play_total;
            freePlayTotal += data.free_play_total;
        });
        userMatches = [
            {
                paid_player: paidPlayer,
                free_player: freePlayer,
                paid_play_total: paidPlayTotal,
                free_play_total: freePlayTotal
            }
        ];
    }

    let html;
    if (htmlType == 11 || htmlType == 22) {
        let tableBody = "";
        userMatches.forEach(data => {
            tableBody += `
            <tr>
             <td style="width: 20%;">${new Date(data.date).toLocaleDateString()}</td>
             <td style="width: 20%;">${numberWithDot(data.paid_player)}</td>
             <td style="width: 20%;">${numberWithDot(data.free_player)}</td>
            <td style="width: 20%;">${numberWithDot(data.paid_play_total)}</td>
             <td style="width: 20%;">${numberWithDot(data.free_play_total)}</td>
            </tr>`;
        });
        html = `
        <h4>Kullanıcı-Oyun Raporu</h4>
         <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 20%; text-align:left">Tarih</th>
            <th style="width: 20%; text-align:left">Ücretli Oynayan Kullanıcı</th>
            <th style="width: 20%; text-align:left">Ücretsiz Oynayan Kullanıcı</th>
            <th style="width: 20%; text-align:left">Ücretli Oyun Sayısı</th>
            <th style="width: 20%; text-align:left">Ücretsiz Oyun Sayısı</th>
            </tr>
           ${tableBody}
            </tbody>
        </table>`;
    } else {
        html = `
        <h4>Kullanıcı-Oyun Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
                <tr>
                    <td style="width: 33.3%;"></td>
                    <td style="width: 33.3%;">Oynayan Kullanıcı</td>
                    <td style="width: 33.3%;"> Toplam Oyun</td>
                </tr>
                 <tr>
                    <td style="width: 33.3%;">Ücretli</td>
                    <td style="width: 33.3%;">${numberWithDot(userMatches[0].paid_player)}</td>
                    <td style="width: 33.3%;">${numberWithDot(userMatches[0].paid_play_total)}</td>
                </tr>
                 <tr>
                    <td style="width: 33.3%;">Ücretsiz</td>
                    <td style="width: 33.3%;">${numberWithDot(userMatches[0].free_player)}</td>
                    <td style="width: 33.3%;">${numberWithDot(userMatches[0].free_play_total)}</td>
                </tr>
                 <tr>
                    <td style="width: 33.3%;">Toplam</td>
                    <td style="width: 33.3%;">${numberWithDot(
            userMatches[0].paid_player + userMatches[0].free_player
        )}</td>
                    <td style="width: 33.3%;">${numberWithDot(
            userMatches[0].paid_play_total + userMatches[0].free_play_total
        )}</td>
                </tr>
            </tbody>
        </table>`;
    }

    return html;
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
        let dailyRewardTrue = 0;
        let dailyRewardFalse = 0;
        let daily_reward_earned = 0;
        let dailyChargeReward = 0;
        let dailyMatchReward = 0;

        matchData.forEach(data => {
            p2pPlay += data.p2p_play;
            p2pPlayPointsEarned += data.p2p_play_points_earned;
            p2mPlay += data.p2m_play;
            p2mPlayPointsEarned += data.p2m_play_points_earned;
            dailyRewardTrue += data.daily_reward_true;
            dailyRewardFalse += data.daily_reward_false;
            daily_reward_earned += data.daily_reward_earned;
            dailyChargeReward += data.daily_charge_reward || 0;
            dailyMatchReward += data.daily_match_reward || 0;
        });
        matchData = [
            {
                p2p_play: p2pPlay,
                p2p_play_points_earned: p2pPlayPointsEarned,
                p2m_play: p2mPlay,
                p2m_play_points_earned: p2mPlayPointsEarned,
                daily_reward_true: dailyRewardTrue,
                daily_reward_false: dailyRewardFalse,
                daily_reward_earned: daily_reward_earned,
                daily_charge_reward: dailyChargeReward,
                daily_match_reward: dailyMatchReward
            }
        ];
    }

    let html;
    if (htmlType == 11 || htmlType == 22) {
        let tableBody = "";
        matchData.forEach(data => {
            tableBody += `
            <tr>
             <td style="width: 10%;">${new Date(data.date).toLocaleDateString()}</td>
             <td style="width: 10%;">${numberWithDot(data.p2p_play)}</td>
             <td style="width: 10%;">${numberWithDot(data.p2p_play_points_earned)}</td>
             <td style="width: 10%;">${numberWithDot(data.p2m_play)}</td>
             <td style="width: 10%;">${numberWithDot(data.p2m_play_points_earned)}</td>
             <td style="width: 10%;">${numberWithDot(data.daily_reward_earned)}</td>
             <td style="width: 10%;">${numberWithDot(data.daily_charge_reward)}</td>
             <td style="width: 10%;">${numberWithDot(data.daily_match_reward)}</td>
             <td style="width: 10%;">${numberWithDot(data.daily_reward_true)}</td>
             <td style="width: 10%;">${numberWithDot(data.daily_reward_false)}</td>
            </tr>`;
        });
        html = `
        <h4>Oyun Raporu</h4>
         <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 10%; text-align:left">Tarih</th>
            <th style="width: 10%; text-align:left">P2P Oyun</th>
            <th style="width: 10%; text-align:left">P2P Kazanılan Puan</th>
            <th style="width: 10%; text-align:left">P2M Oyun</th>
            <th style="width: 10%; text-align:left">P2M Kazanılan Puan</th>
            <th style="width: 10%; text-align:left">Günlük Hakediş</th>
            <th style="width: 10%; text-align:left">Ücretli Oyuna Katılım Ödülü</th>
            <th style="width: 10%; text-align:left">Maç Sonu Kazanılan Ödül</th>
            <th style="width: 10%; text-align:left">Günlük 1GB Başarılı</th>
            <th style="width: 10%; text-align:left">Günlük 1GB Başarısız</th>
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
                <td style="width: 12.5%;"></td>
                <td style="width: 12.5%; font-weight: bold;">Oyun Sayısı</td>
                <td style="width: 12.5%; font-weight: bold;">Kazanılan Puan</td>
                <td style="width: 12.5%; font-weight: bold;">Günlük Hakediş</td>
                <td style="width: 12.5%; font-weight: bold;">Ücretli Oyuna Katılım Ödülü</td>
                <td style="width: 12.5%; font-weight: bold;">Maç Sonu Kazanılan Ödül</td>
                <td style="width: 12.5%; font-weight: bold;">Günlük 1GB Başarılı</td>
                <td style="width: 12.5%; font-weight: bold;">Günlük 1GB Başarısız</td>
            </tr>
             <tr>
                <td style="width: 12.5%; font-weight: bold;">P2P</td>
                <td style="width: 12.5%;">${numberWithDot(matchData[0].p2p_play)}</td>
                <td style="width: 12.5%;">${numberWithDot(matchData[0].p2p_play_points_earned)}</td>
                <td style="width: 12.5%;">-</td>
                <td style="width: 12.5%;">-</td>
                <td style="width: 12.5%;">-</td>
                <td style="width: 12.5%;">-</td>
                <td style="width: 12.5%;">-</td>
            </tr>
             <tr>
                <td style="width: 12.5%; font-weight: bold;">P2M</td>
                <td style="width: 12.5%;">${numberWithDot(matchData[0].p2m_play)}</td>
                <td style="width: 12.5%;">${numberWithDot(matchData[0].p2m_play_points_earned)}</td>
                <td style="width: 12.5%;">-</td>
                <td style="width: 12.5%;">-</td>
                <td style="width: 12.5%;">-</td>
                <td style="width: 12.5%;">-</td>
                <td style="width: 12.5%;">-</td>
            </tr>
            <tr>
                <td style="width: 12.5%; font-weight: bold;">Toplam</td>
                <td style="width: 12.5%;">${numberWithDot(matchData[0].p2p_play + matchData[0].p2m_play)}</td>
                <td style="width: 12.5%;">${numberWithDot(matchData[0].p2p_play_points_earned +
            matchData[0].p2m_play_points_earned)}</td>
                <td style="width: 12.5%;">${numberWithDot(matchData[0].daily_charge_reward || 0)}</td>
                <td style="width: 12.5%;">${numberWithDot(matchData[0].daily_match_reward || 0)}</td>
                <td style="width: 12.5%;">${numberWithDot(matchData[0].daily_reward_earned)}</td>
                <td style="width: 12.5%;">${numberWithDot(matchData[0].daily_reward_true)}</td>
                <td style="width: 12.5%;">${numberWithDot(matchData[0].daily_reward_false)}</td>
            </tr>
            </tbody>
        </table>`;
    }

    return html;
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

async function chargeReport(reportType, dateFilter) {
    let defaultReportType;
    if (reportType == 1 || reportType == 11 || reportType == 22 || reportType == 2) {
        defaultReportType = reportType;
        reportType = 0;
    }

    const db = await Api.useDatabase();
    const chargeCollection = db.collection(`bucket_${CHARGE_REPORT_BUCKET}`);

    let chargeData = await chargeCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 47", e);
            return res.status(400).send({ message: e });
        });

    if (defaultReportType == 1 || defaultReportType == 2) {
        let result = [];
        chargeData.reduce(function (res, value) {
            if (!res[value.error]) {
                res[value.error] = {
                    charge_amount: "7 TL",
                    status: value.status,
                    quantity: 0,
                    play_count: 0,
                    error: value.error
                };
                result.push(res[value.error]);
            }
            res[value.error].quantity += value.quantity;
            if (value.error == '-') {
                res[value.error].play_count += value.play_count != '-' ? Number(value.play_count) : 0;
            }
            return res;
        }, {});
        chargeData = result;
    }

    let chargeBody = "";
    let totalQuantity = 0;
    let totalPlayCount = 0;
    let lastDate = "";

    chargeData.forEach((charge, index) => {
        totalQuantity += charge.quantity;
    })

    chargeData.forEach((charge, index) => {
        let date = charge.date;
        totalPlayCount += charge.play_count != '-' ? Number(charge.play_count) : 0;
        if (defaultReportType == 1 || defaultReportType == 2) {
            let now = new Date();
            date = now.setDate(now.getDate() - 1);
        }

        if (lastDate && lastDate != new Date(date).toDateString()) {
            chargeBody += `
                <tr>
                    <td style="width: 10%;">---</td>
                    <td style="width: 10%;">---</td>
                    <td style="width: 10%;">---</td>
                    <td style="width: 10%;">---</td>
                    <td style="width: 10%;">---</td>
                    <td style="width: 10%;">---</td>
                    <td style="width: 40%;">---</td>
                </tr>`
        }

        let ratio = defaultReportType == 1 ? charge.quantity == 0 ? 0 : ((charge.quantity / totalQuantity) * 100).toFixed(2) : charge.ratio;

        chargeBody += `<tr>
                    <td style="width: 10%;">${new Date(date).toLocaleDateString()}</td>
                    <td style="width: 10%;">${charge.charge_amount}</td>
                    <td style="width: 10%;">${numberWithDot(charge.quantity)}</td>
                    <td style="width: 10%;">${ratio}</td>
                    <td style="width: 10%;">${numberWithDot(charge.play_count)}</td>
                    <td style="width: 10%;">${charge.status}</td>
                    <td style="width: 40%;">${charge.error}</td>
                    </tr>
                    `;

        lastDate = new Date(date).toDateString();
    });

    let chargeHtml = `
        <h4>Charging Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 10%; text-align:left">Tarih</th>
            <th style="width: 10%; text-align:left">Charging miktarı</th>
            <th style="width: 10%; text-align:left">Adet</th>
            <th style="width: 10%; text-align:left">Oran</th>
            <th style="width: 10%; text-align:left">Oyun Hakkı</th>
            <th style="width: 10%; text-align:left">Sonu&ccedil;</th>
            <th style="width: 40%; text-align:left">Hata Detayı</th>
            </tr>
            ${chargeBody}
             <tr>
                <th style="width: 10%; text-align:left">Toplam</th>
                <th style="width: 10%; text-align:left">-</th>
                <th style="width: 10%; text-align:left">${numberWithDot(totalQuantity)}</th>
                <th style="width: 10%; text-align:left">-</th>
                <th style="width: 10%; text-align:left">${numberWithDot(totalPlayCount)}</th>
                <th style="width: 10%; text-align:left">-</th>
                <th style="width: 40%; text-align:left">-</th>
            </tr>
            </tbody>
        </table>`;

    return chargeHtml;
}

async function retryReport(reportType, dateFilter) {
    let defaultReportType;
    if (reportType == 1 || reportType == 11 || reportType == 22 || reportType == 2) {
        defaultReportType = reportType;
        reportType = 0;
    }

    const db = await Api.useDatabase();
    const retryCollection = db.collection(`bucket_${RETRY_REPORT_BUCKET}`);

    let retryData = await retryCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 41", e);
            return res.status(400).send({ message: e });
        });

    if (defaultReportType == 2 || defaultReportType == 1) {
        let currentDate = new Date();
        let daily_retry_false = 0;
        let daily_retry_true = 0;

        retryData.forEach(data => {
            daily_retry_false += data.daily_retry_false;
            daily_retry_true += data.daily_retry_true;
        });
        retryData = [
            {
                date: currentDate.setDate(currentDate.getDate() - 1),
                daily_retry_false: daily_retry_false,
                daily_retry_true: daily_retry_true
            }
        ];
    }


    let tableBody = "";
    retryData.forEach(data => {
        tableBody += `
            <tr>
             <td style="width: 33.3%;">${new Date(data.date).toLocaleDateString()}</td>
             <td style="width: 33.3%;">${numberWithDot(data.daily_retry_false)}</td>
             <td style="width: 33.3%;">${numberWithDot(data.daily_retry_true)}</td>
            </tr>`;
    });

    let retryHtml = `
        <h4>Retry Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 33.3%; text-align:left">Tarih</th>
            <th style="width: 33.3%; text-align:left">Günlük Başarısız</th>
            <th style="width: 33.3%; text-align:left">Günlük Başarılı</th>
            </tr>
           ${tableBody}
            </tbody>
        </table>`;

    return retryHtml;
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

    if (defaultReportType == 1 || defaultReportType == 2) {
        let result = [];
        rewardData.reduce(function (res, value) {
            if (!res[value.error_text]) {
                res[value.error_text] = {
                    count: 0,
                    error_text: value.error_text
                };
                result.push(res[value.error_text]);
            }
            res[value.error_text].count += value.count;
            return res;
        }, {});
        rewardData = result;
    }

    let rewardBody = "";
    let total = 0;
    let lastDate = "";

    rewardData.forEach((reward, index) => {
        total += reward.count;
    })
    rewardData.forEach((reward, index) => {
        let date = reward.date;
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
                    <td style="width: 70%;">---</td>
                </tr>`
        }

        let ratio = defaultReportType == 1 ? reward.count == 0 ? 0 : ((reward.count / total) * 100).toFixed(2) : reward.ratio;
        rewardBody += `<tr>
                    <td style="width: 10%;">${new Date(date).toLocaleDateString()}</td>
                    <td style="width: 10%;">${numberWithDot(reward.count)}</td>
                    <td style="width: 10%;">${ratio}</td>
                    <td style="width: 70%;">${reward.error_text}</td>
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
            <th style="width: 10%; text-align:left">Adet</th>
            <th style="width: 10%; text-align:left">Oran</th>
            <th style="width: 70%; text-align:left">Hata Detayı</th>
            </tr>
            ${rewardBody}
             <tr>
            <th style="width: 10%; text-align:left">Toplam</th>
            <th style="width: 10%; text-align:left">${numberWithDot(total)}</th>
            <th style="width: 10%; text-align:left">-</th>
            <th style="width: 70%; text-align:left">-</th>
            </tr>
            </tbody>
        </table>`;

    return rewardHtml;
}

function numberWithDot(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}