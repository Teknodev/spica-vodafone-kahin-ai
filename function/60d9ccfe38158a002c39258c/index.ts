import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const REWARD_QUEUE_BUCKET = VARIABLE.BUCKET.REWARD_QUEUE;
const USER_BUCKET = VARIABLE.BUCKET.USER;
const NOTIFICATION_BUCKET = VARIABLE.BUCKET.NOTIFICATION_LOG;
const SECRET_KEY = VARIABLE.SECRET_API_KEY;

export async function applyRewardManually(change) {
    let msisdn = change.current.msisdn;
    if (!msisdn) return;

    if (msisdn.startsWith("90")) {
        msisdn = msisdn.substring(2)
    }

    Api.insertOne(REWARD_QUEUE_BUCKET, {
        msisdn,
        created_at: new Date(),
        next_try_date: new Date(),
        txn_id: String(Date.now()),
        purpose: change.current.purpose
    })
}

export async function setSubscriptionStatus() {
    console.log("@setSubscriptionStatus")
    const now = new Date();

    const date1 = now.setMinutes(now.getMinutes() - 2);
    const date2 = now.setMinutes(now.getMinutes() - 10);

    const userFilter = {
        created_at: {
            $lte: new Date(date1),
            $gte: new Date(date2),
        },
        subscription_status: {
            $exists: false
        }
    }

    const users = await Api.getMany(USER_BUCKET, userFilter);

    if (!users.length) return "0"

    const identitiesIds = Array.from(users, i => Api.toObjectId(i.identity));

    if (!identitiesIds.length) return "0"
    
    const db = await Api.useDatabase();
    const identities = await db.collection('identity').find({
        _id: { $in: identitiesIds }
    }).toArray().catch(console.error)

    if (!identities.length) return "0"

    const msisdns = Array.from(identities, i => i.identifier);

    let notifications = await Api.getMany(NOTIFICATION_BUCKET, {
        notification: { $in: ["SubscriptionCreated", "SubscriptionDeactivated", "SubscriptionSuspended", "CreateSubscriptionFailed", "SubscriptionResumed"] },
        msisdn: { $in: msisdns }
    });

    if (!notifications.length) return "0";

    const lastNotifications = getLastNotifications(notifications);

    const notificationsWithIdentity = [];
    lastNotifications.forEach(el => {
        let tempIdentity = identities.find(i => el.msisdn == i.identifier);

        if (tempIdentity) {
            notificationsWithIdentity.push({ ...el, identity: String(tempIdentity._id) })
        }
    })

    const NOTIFICATION = {
        SUBSCRIPTION_CREATED: "SubscriptionCreated",
        CREATE_SUBSCRIPTION_FAILED: "CreateSubscriptionFailed",
        SUBSCRIPTION_SUSPENDED: "SubscriptionSuspended",
        SUBSCRIPTION_RESUMED: "SubscriptionResumed",
        SUBSCRIPTION_RENEWED: "SubscriptionRenewed",
        SUBSCRIPTION_WILL_BE_DEACTIVATED: "SubscriptionWillBeDeactivated",
        SUBSCRIPTION_DEACTIVATED: "SubscriptionDeactivated",
        SUBSCRIPTION_DEACTIVATION_FAILED: "SubscriptionDeactivationFailed",
        ADVANCE_CHARGING_SUCCESSFUL: "AdvanceChargingSuccessful"
    }

    const SUB_STATUS = {
        [NOTIFICATION.SUBSCRIPTION_CREATED]: "active",
        [NOTIFICATION.SUBSCRIPTION_SUSPENDED]: "suspended",
        [NOTIFICATION.SUBSCRIPTION_DEACTIVATED]: "deactiveted",
        [NOTIFICATION.SUBSCRIPTION_RESUMED]: "active",
        [NOTIFICATION.CREATE_SUBSCRIPTION_FAILED]: "inactive",

    }

    const Bucket = Api.useBucket();

    const nonrewarded = [];

    for (const el of notificationsWithIdentity) {
        nonrewarded.push(el.msisdn.substring(2))
        const parsedBody = JSON.parse(el.body);

        if (parsedBody?.params?.subscription?.startDate) {
            let updateData = {
                subscription_status: SUB_STATUS[el.notification],
                subscription_start_date: formatDate(parsedBody.params.subscription.startDate),
                subscription_next_renewal_date: formatDate(parsedBody.params.subscription.nextRenewalDate),
                subscription_last_renewal_date: formatDate(parsedBody.params.subscription.lastRenewalDate),
                range_reward_count: 0,
                range_award: 3,
                total_award: 3
            }

            const [user] = await Bucket.data.getAll(USER_BUCKET, { queryParams: { filter: { identity: String(el.identity) } } })
            console.log("user: ", user)
            if (user) {
                await Bucket.data.patch(USER_BUCKET, user._id, updateData).catch(console.error)
            }
        }
    }

    for (const msisdn of nonrewarded) {
        const [reward] = await Bucket.data.getAll("609669f805b0df002ceb2517", { queryParams: { filter: { msisdn: msisdn, status: true } } })
        if (!reward) {
            console.log("reward: ", msisdn)
            Api.insertOne(REWARD_QUEUE_BUCKET, {
                msisdn,
                created_at: new Date(),
                next_try_date: new Date(),
                txn_id: String(Date.now()),
                purpose: 'charge'
            })
        }
    }

    return nonrewarded
}

export function getLastNotifications(data) {

    const latestData = {};

    data.forEach(el => {
        const msisdn = el.msisdn;
        const date = new Date(el.created_at);
        if (!latestData[msisdn] || date > latestData[msisdn].created_at) {
            latestData[msisdn] = {
                msisdn: msisdn,
                created_at: date,
                notification: el.notification,
                body: el.body,
            };
        }
    });

    const latestDataArray = Object.values(latestData);
    return latestDataArray;
}

function formatDate(inputDateString) {

    const [day, month, yearTime] = inputDateString.split("/");
    const [year, time] = yearTime.split(" ");
    const [hour, minute, second] = time.split(":");
    const milliseconds = Number(second.split(".")[1]);

    const formattedDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, milliseconds));

    formattedDate.setUTCHours(formattedDate.getUTCHours() - 6);

    const options = {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);

    return new Date(formatter.format(formattedDate));
}