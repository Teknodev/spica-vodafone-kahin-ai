import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const PAST_MATCH_BUCKET = VARIABLE.BUCKET.PAST_MATCH;

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

    let p2p = [];
    let p2b = [];
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

        p2p.push(result.p2p);
        p2b.push(result.p2b);
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
            { data: p2p, label: "Player VS Player" },
            { data: p2b, label: "Player VS Bot" },
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
        label: ["Player VS Player", "Player VS Bot"],
        data: [
            result.p2p,
            result.p2b
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

    const p2p = await pastMachesCollection
        .find({
            player_type: 0,
            end_time: dateFilter
        })
        .count()
        .catch(err => console.log("ERROR 5", err));


    const p2b = await pastMachesCollection
        .find({
            player_type: 1,
            end_time: dateFilter
        })
        .count()
        .catch(err => console.log("ERROR 8", err));


    let result = {
        p2p,
        p2b,
        total: p2p + p2b
    };

    return result;
}