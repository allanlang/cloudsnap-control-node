var AWS = require('aws-sdk'),
    async = require('async'),
    fs = require('fs'),
    sqs_queue_url = process.argv[2],
    s3_bucket_name = process.argv[3];

// Configure AWS APIs
AWS.config.loadFromPath('aws_config.json');
AWS.config.apiVersions = {
    sqs: '2012-11-05',
    s3: '2006-03-01'
};

var sqs = new AWS.SQS(),
    s3 = new AWS.S3();

console.log('CloudSnapController: Polling queue ' + sqs_queue_url);
console.log('CloudSnapController: Sending images to ' + s3_bucket_name);

setInterval(function () {
    mainLoop()
}, 1000);

function mainLoop() {
    async.waterfall([
            function fetchMessage(next) {
                sqs.receiveMessage({
                    QueueUrl: sqs_queue_url,
                    MaxNumberOfMessages: 1
                }, next);
            },
            function handleMessageReceive(response, next) {
                if (response.Messages) {
                    var message = response.Messages[0];
                    var body = JSON.parse(message.Body);
                    console.log(body);
                    sqs.deleteMessage({
                        QueueUrl: sqs_queue_url,
                        ReceiptHandle: message.ReceiptHandle
                    }, function (err, data) {
                        next(err, body);
                    });
                } else {
                    console.log('No message available');
                }
            },
            function processCommand(body, next) {
                console.log('Processing command \'' + body.command + '\' from user ' + body.user);
                next(null, body);
            },
            function captureImage(body, next) {
                console.log('Capturing image');
                next(null, body.requestid, 'sample-image.jpg');
            },
            function uploadImage(requestid, imagefile, next) {
                console.log('Uploading image with key ' + requestid + '.jpg');
                s3.putObject({
                    Bucket: s3_bucket_name,
                    Key: requestid + '.jpg',
                    ACL: 'public-read',
                    ContentType: 'image/jpeg',
                    StorageClass: 'REDUCED_REDUNDANCY',
                    Body: fs.createReadStream(imagefile)
                }, next);
            }
        ], function (err) {
            if (err) {
                console.error(err, err.stack);
            } else {
                console.log('Message processed successfully');
            }
        }
    )
}