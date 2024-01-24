import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as User from "../../63b6a403ebfd83002c5e104e/.build";
import * as Auth from "../../60d9cb8b38158a002c39254d/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const NOTIFICATION_LOG_BUCKET = VARIABLE.BUCKET.NOTIFICATION_LOG;
const REWARD_QUEUE_BUCKET = VARIABLE.BUCKET.REWARD_QUEUE;
const CHARGE_BUCKET = VARIABLE.BUCKET.CHARGE;

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

const SUBSCRIPTION_NOTIFICATIONS = [
    NOTIFICATION.SUBSCRIPTION_CREATED,
    NOTIFICATION.CREATE_SUBSCRIPTION_FAILED,
    NOTIFICATION.SUBSCRIPTION_SUSPENDED,
    NOTIFICATION.SUBSCRIPTION_RESUMED,
    NOTIFICATION.SUBSCRIPTION_RENEWED,
    NOTIFICATION.SUBSCRIPTION_WILL_BE_DEACTIVATED,
    NOTIFICATION.SUBSCRIPTION_DEACTIVATED,
    NOTIFICATION.SUBSCRIPTION_DEACTIVATION_FAILED,
]

export async function serviceListener(req, res) {
    const body = req.body
    const notification = body.notification;
    console.log(body)

    if (!SUBSCRIPTION_NOTIFICATIONS.includes(notification)) {
        nonSubscriptionNotification(body);
        return "ok";
    }

    const msisdn = body.params.msisdn;

    insertNotificationLog(body, msisdn);

    let user = await User.getByMsisdn(msisdn);
    if (!user) {
        await Auth.smsFlowRegister(msisdn)
        user = await User.getByMsisdn(msisdn);
    };

    if (!user) {
        console.error("ERR USER: ", msisdn)
        return "err"
    };

    const handleNotification = {
        [NOTIFICATION.SUBSCRIPTION_CREATED]: (props) => subscriptionCreated(props.msisdn, props.user, props.body),
        [NOTIFICATION.CREATE_SUBSCRIPTION_FAILED]: (props) => createSubscriptionFailed(props.msisdn, props.user, props.body),
        [NOTIFICATION.SUBSCRIPTION_SUSPENDED]: (props) => subscriptionSuspended(props.msisdn, props.user, props.body),
        [NOTIFICATION.SUBSCRIPTION_RESUMED]: (props) => subscriptionResumed(props.msisdn, props.user, props.body),
        [NOTIFICATION.SUBSCRIPTION_RENEWED]: (props) => subscriptionRenewed(props.msisdn, props.user, props.body),
        [NOTIFICATION.SUBSCRIPTION_WILL_BE_DEACTIVATED]: (props) => subscriptionWillBeDeactivated(props.msisdn, props.user, props.body),
        [NOTIFICATION.SUBSCRIPTION_DEACTIVATED]: (props) => subscriptionDeactivated(props.msisdn, props.user, props.body),
        [NOTIFICATION.SUBSCRIPTION_DEACTIVATION_FAILED]: (props) => subscriptionDeactivationFailed(props.msisdn, props.user, props.body),
    }

    handleNotification[notification]({ msisdn, user, body });

    return "ok";
}

async function subscriptionCreated(msisdn, user, body) {
    const subscription = body.params.subscription;
    console.log("@subscriptionCreated: ", msisdn, user, subscription);
    if (user) {
        await User.updateOne({ _id: user._id }, {
            $set: {
                available_play_count: 1,
                range_award: 0,
                range_point: 0,
                range_reward_count: 0,
                subscription_status: 'active',
                subscription_start_date: formatDate(subscription.startDate),
                subscription_next_renewal_date: formatDate(subscription.nextRenewalDate),
                subscription_last_renewal_date: formatDate(subscription.lastRenewalDate),
            }
        })
    }

    setReward(msisdn);
}

function createSubscriptionFailed(msisdn, user, body) {
    console.error("@createSubscriptionFailed: ", body)
}

async function subscriptionSuspended(msisdn, user, body) {
    const subscription = body.params.subscription;

    if (user) {
        await User.updateOne({ _id: user._id }, {
            $set: {
                subscription_status: 'suspended',
            }
        })
    }
}

async function subscriptionResumed(msisdn, user, body) {
    const subscription = body.params.subscription;
    // !TODO not shure about action

    if (user) {
        await User.updateOne({ _id: user._id }, {
            $set: {
                // available_play_count: 1,
                // range_award: 0,
                // range_reward_count: 0,
                subscription_status: 'active',
                subscription_next_renewal_date: formatDate(subscription.nextRenewalDate),
                subscription_last_renewal_date: formatDate(subscription.lastRenewalDate),
            }
        })
    }

    // !TODO not shure about action
    // setReward(msisdn);
}

async function subscriptionRenewed(msisdn, user, body) {
    const subscription = body.params.subscription;

    if (user) {
        await User.updateOne({ _id: user._id }, {
            $set: {
                available_play_count: 1,
                range_award: 0,
                range_point: 0,
                range_reward_count: 0,
                subscription_status: 'active',
                subscription_next_renewal_date: formatDate(subscription.nextRenewalDate),
                subscription_last_renewal_date: formatDate(subscription.lastRenewalDate),
            }
        })
    }

    setReward(msisdn);
}

function subscriptionWillBeDeactivated(msisdn, user, body) {
    console.error("@subscriptionWillBeDeactivated: ", body)
    // TODO
}

async function subscriptionDeactivated(msisdn, user, body) {
    const subscription = body.params.subscription;

    if (user) {
        await User.updateOne({ _id: user._id }, {
            $set: {
                subscription_status: 'deactivated',
                subscription_end_date: new Date(),
            }
        })
    }
}

function subscriptionDeactivationFailed(msisdn, user, body) {
    console.error("@subscriptionDeactivationFailed: ", body)
}

function nonSubscriptionNotification(body) {
    const notification = body.notification;
    let msisdn = "0000";

    switch (notification) {
        case NOTIFICATION.ADVANCE_CHARGING_SUCCESSFUL:
            const charging = body.params.charging;
            msisdn = charging.chargedMsisdn;
            const insertData = {
                tx_key: body.txKey,
                msisdn,
                date: new Date(),
                status: true,
                purpose: charging.chargingPurpose,
                amount: charging.amount
            }
            Api.insertOne(CHARGE_BUCKET, insertData)
            break;
    }

    insertNotificationLog(body, msisdn);
}

async function setReward(msisdn) {
    console.log("@setReward: ", msisdn)
    if (msisdn.startsWith("90")) {
        msisdn = msisdn.substring(2)
    }

    Api.insertOne(REWARD_QUEUE_BUCKET, {
        msisdn,
        created_at: new Date(),
        next_try_date: new Date(),
        txn_id: String(Date.now()),
        purpose: 'charge'
    }).catch(err => console.log("ERROR charge reward: ", err))
}

function insertNotificationLog(body, msisdn) {
    Api.insertOne(NOTIFICATION_LOG_BUCKET, {
        msisdn,
        notification: body.notification,
        notification_key: body.notificationKey,
        created_at: new Date(),
        body: JSON.stringify(body)
    })
}

function formatDate(inputDateString) {
    // const date = new Date(inputDateString);

    // if (!isNaN(date.getTime())) {
    //     return date;
    // }

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