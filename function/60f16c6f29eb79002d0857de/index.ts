import { database, ObjectId } from "@spica-devkit/database";
import * as Bucket from "@spica-devkit/bucket";
const json2csv = require("json2csv").parse;
const admz = require("adm-zip");


/*

 FIRST, RUN THIS API CALL  https://`${YOUR DOMAIN}/api/fn-execute/initializeExportExcel` 
  This mean you can get entries with download link for all buckets in Exporter-Templates bucket.

 line:31 key:bucketId description : Must be a string
 line:31 key:columns description : Must be a string with ',' of between they . For example `_id,first_name,email`.
 line:31 key:queryFilter decription : Must be an object . For example  {"email":"test@123"}


 This function callable like  :
  https://${YOUR DOMAIN}/api/fn-execute/excelExport?bucketId=60645720a37829002c4a510e&columns=email,first_name&queryFilter={"email":"test@123"}
  The links will already be available in the Exporter-Templates bucket after you trigger the initializeExportExcel function.

 You can change the format of the file in the environment variable. Acceptable formats are xls or csv.

 You can also restart the initializeExportExcel function, but this time the function will delete the items
  it has created and will create again. Note that : Auto-created items are auto marked items.

 Don't remember change all custom fields with yours !


*/

Bucket.initialize({ apikey: process.env.AUTH_APIKEY });

export async function excelExport(req, res) {
    const { bucketId, columns, queryFilter } = req.query;

    //If columns are null, function will export all columns.
    //If queryFilter is null, function will export all data.

    let schema = await Bucket.get(bucketId).catch(e => {
        return res.status(400).send({ message: e });
    });

    let datas = await Bucket.data
        .getAll(bucketId, {
            queryParams: {
                filter: queryFilter
            }
        })
        .catch(e => {
            return res.status(400).send({ message: e });
        });

    let headers = Object.keys(schema.properties); // Get properties
    let formattedString;
    if (datas[0]) {
        if (columns && columns != "null") {
            let columnsArr = columns.split(",");
            headers = columnsArr;
        }

        formattedString = json2csv(datas, { fields: headers });
        headers.forEach(item => {
            formattedString = formattedString.replace(item, item.replace("_", " ").toUpperCase());
            // Setting headers of csv, for example "_id" and "first_name" keys will be "ID" AND "FIRST NAME" header.
        });
        var zp = new admz();

        switch (`${process.env.FORMAT_TYPE}`) {
            case "xls":
                zp.addFile(
                    "download-" + Date.now() + ".xlsx",
                    Buffer.alloc(formattedString.length, formattedString),
                    "entry comment goes here"
                );
                break;
            case "csv":
                zp.addFile(
                    "download-" + Date.now() + ".csv",
                    Buffer.alloc(formattedString.length, formattedString),
                    "entry comment goes here"
                );
                break;
        }
        res.headers.set(
            "Content-Disposition",
            "attachment; filename=download-" + Date.now() + ".zip"
        );
        res.headers.set("Content-Type", "application/octet-stream");
        formattedString = zp.toBuffer();
        return res.status(200).send(formattedString);
    }
    return res.status(400).send({ message: "There is no data" });
}

export async function initialize(req, res) {
    const DOMAIN = req.headers.get("host");
    let buckets = await Bucket.getAll();
    let promisesAdd = [];
    let promisesDelete = [];

    let existEntries = await Bucket.data.getAll(`${process.env.BUCKET_EXPORT_TEMPLATES}`, {
        queryParams: {
            filter: {
                auto: true
            }
        }
    });
    if (existEntries.length) {
        existEntries.forEach(entry => {
            promisesDelete.push(
                Bucket.data.remove(`${process.env.BUCKET_EXPORT_TEMPLATES}`, entry._id)
            );
        });
        await Promise.all(promisesDelete)
            .then(_ => console.log("PROMISES DELETE DONE"))
            .catch(e => console.log("SOMETHING WENT WRONG WHEN DELETE", e));
    }

    if (buckets.length) {
        let hrefLink;
        buckets.forEach(bucket => {
            if (bucket._id != `${process.env.BUCKET_EXPORT_TEMPLATES}`) {
                hrefLink = `https://${DOMAIN}/api/fn-execute/excelExport?bucketId=${bucket._id}&columns=null&queryFilter=null`;
                let entry = {
                    title: bucket.title + "`s Export",
                    link: `<a href=${hrefLink} target="_blank"> ${hrefLink}</a>`,
                    auto: true
                };
                promisesAdd.push(
                    Bucket.data.insert(`${process.env.BUCKET_EXPORT_TEMPLATES}`, entry)
                );
            }
        });
        await Promise.all(promisesAdd)
            .then(data => console.log("PROMISES INSERT DONE :", data))
            .catch(e => console.log("SOMETHING WENT WRONG WHEN INSERT", e));
    }

    return res.status(200).send({ message: "Ok" });
}

export async function updateLink(change) {
    const pre_doc = change.previous;
    let cur_doc = change.current;
    if (
        (cur_doc.from_date && pre_doc.from_date != cur_doc.from_date) ||
        (cur_doc.to_date && pre_doc.to_date != cur_doc.to_date) ||
        (cur_doc.property_name && pre_doc.property_name != cur_doc.property_name)
    ) {
        let old_link = pre_doc.link.split("queryFilter=")[1].split(" ")[0];
        let new_link = `{"${cur_doc.property_name}":{"$gte":"Date(${cur_doc.from_date})","$lt":"Date(${cur_doc.to_date})"}}`;
        cur_doc.link = cur_doc.link
            .split(`queryFilter=${old_link}`)
            .join(`queryFilter=${new_link}`);
        Bucket.data.update(`${process.env.BUCKET_EXPORT_TEMPLATES}`, cur_doc._id, cur_doc);
    }
    return {};
}


export async function exportConfrimationCodes(req, res) {
    let dateFilter = {
        $gte: new Date(`06-25-2022 21:00:00`),
        $lte: new Date(`06-30-2022 21:00:00`)
    };

    const db = await database();

    const collection = db.collection(`bucket_609669f805b0df002ceb2517`);
    const datas = await collection.find({
        date: dateFilter
    }).toArray();
    let formattedString = json2csv(datas, { fields: ['offer_id', 'order_id', 'msisdn', 'error_id', 'user_text', 'date', 'status', 'match_id', 'result'] });


    var zp = new admz();

    zp.addFile(
        "download-" + Date.now() + ".csv",
        Buffer.alloc(formattedString.length, formattedString),
        "entry comment goes here"
    );

    res.headers.set(
        "Content-Disposition",
        "attachment; filename=download-" + Date.now() + ".zip"
    );
    res.headers.set("Content-Type", "application/octet-stream");
    formattedString = zp.toBuffer();
    return res.status(200).send(formattedString);
}


export async function exportConfrimationCodesDelete(req, res) {
    const db = await database();

    const collection = db.collection(`bucket_609669f805b0df002ceb2517`);
    // const count = await collection.estimatedDocumentCount();
    // console.log(count)

    let dateFilter = {
        $gte: new Date('05-31-2022 20:00:00'),
        $lte: new Date('06-30-2022 21:00:00')
    };
    await collection.deleteMany({
        date: dateFilter
    }).catch((err) => console.log("ERROR", err))

    return true;
}

export async function exportDatasManually(req, res) {
    const db = await database();


    // PAST MATCHES
    // const collection = db.collection(`bucket_60742ed3f95e39002c4917ae`);
    // let dateFilter = {
    //     $gte: new Date(`11-06-2021 12:00:00`),
    //     $lte: new Date(`11-06-2021 21:00:00`)
    // };


    // REWARDS
    // const collection = db.collection(`bucket_609669f805b0df002ceb2517`);
    // let dateFilter = {
    //     $gte: new Date(`08-25-2022 21:00:00`),
    //     $lte: new Date(`08-31-2022 21:00:00`)
    // };


    // CHARGES
    const collection = db.collection(`bucket_60ab7235c03a2d002eb2f574`);
    let dateFilter = {
        $gte: new Date(`01-22-2022 21:00:00`),
        $lte: new Date(`01-31-2022 21:00:00`)
    };


    const datas = await collection.find({
        date: dateFilter
    })
        .limit(200000)
        .toArray();

    // REWARDS
    // let formattedString = json2csv(datas, { fields: ['_id', 'offer_id', 'order_id', 'msisdn', 'error_id', 'user_text', 'date', 'status', 'result', 'match_id', 'type'] });

    // PAST MATCHES
    // let formattedString = json2csv(datas, { fields: ['_id', 'name', 'user1', 'user2', 'winner', 'user1_answers', 'user2_answers', 'user1_points', 'user2_points', 'start_time', 'end_time', 'duel_type', 'points_earned', 'user1_is_free', 'user2_is_free', 'duel_id'] });

    // CHARGES
    let formattedString = json2csv(datas, { fields: ['_id', 'order_id', 'msisdn', 'user_text', 'date', 'status', 'result'] });


    var zp = new admz();

    zp.addFile(
        "download-" + Date.now() + ".csv",
        Buffer.alloc(formattedString.length, formattedString),
        "entry comment goes here"
    );

    res.headers.set(
        "Content-Disposition",
        "attachment; filename=download-" + Date.now() + ".zip"
    );
    res.headers.set("Content-Type", "application/octet-stream");
    formattedString = zp.toBuffer();
    return res.status(200).send(formattedString);
}

export async function exportDatasManuallyDelete(req, res) {
    const db = await database();

    // REWARDS
    // let dateFilter = {
    //     $gte: new Date(`08-20-2022 21:00:00`),
    //     $lte: new Date(`08-31-2022 21:00:00`)
    // };
    // const collection = db.collection(`bucket_609669f805b0df002ceb2517`);

    // PAST MATCHES
    // const collection = db.collection(`bucket_60742ed3f95e39002c4917ae`);
    // let dateFilter = {
    //     $gte: new Date(`11-02-2021 21:00:00`),
    //     $lte: new Date(`11-06-2021 21:00:00`)
    // };

    // CHARGES
    const collection = db.collection(`bucket_60ab7235c03a2d002eb2f574`);
    let dateFilter = {
        $gte: new Date(`01-25-2022 21:00:00`),
        $lte: new Date(`01-31-2022 21:00:00`)
    };

    await collection.deleteMany({
        date: dateFilter
    }).catch((err) => console.log("ERROR", err))

    return true;
}
