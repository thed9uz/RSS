const http = require('http')
const https = require('https')
const express = require("express")();
const strQuery = require('query-string')
const xmljs = require("xml2json");
const _url = require('url');
const { exception } = require('console');



const MongoClient = require('mongodb').MongoClient


async function RssLink(Link) {
   
    let prom = new Promise((resolve, reject) => {
       
        let RequestUrl = _url.parse(Link)

        let calledExecuter = http
        var htmlData = ''
        if (RequestUrl.protocol == "https:")
            calledExecuter = https


        let options = {
            hostname: RequestUrl.hostname,
            path: RequestUrl.path,
            method: "GET"

        }
        let xmlRequest = calledExecuter.request(options, (response) => {

            response.on('error', (error) => {
                console.log(error.message)
            })
            response.on('data', (chunks) => {
                htmlData += chunks;
            })
            response.on('end', () => {
                if (response.headers["content-type"].toLowerCase().indexOf('application/rss+xml') != -1 || response.headers["content-type"].toLowerCase().indexOf('application/atom+xml') != -1 || response.headers["content-type"].toLowerCase().indexOf('application/xml') != -1) {
                    resolve(Link)
                    return 0

                } else {
                    let innerHtml = false
                    let parsed = []
                    let start = 0
                    let end = 0
                    let t = ''
                    while (htmlData.search(/<Link /ig) != -1) {
                        start = htmlData.search(/<Link /ig)
                        end = start
                        while (htmlData[end] != '>')
                            end++;
                        end++;
                        t = htmlData.substring(start, end)
                        htmlData = htmlData.replace(t, '')
                        parsed.push(JSON.parse(xmljs.toJson(t), (cor, val) => {
                            var low = cor.toLowerCase();
                            if (cor === low) return val;
                            else this[low] = val;
                        }))

                    }
                    for (var step = 0; step < parsed.length; step++) {
                        if (parsed[step].link.type == undefined) {
                            delete parsed[step]
                            continue
                        }
                        if (parsed[step].link.type.toLowerCase() == 'application/rss+xml' || parsed[step].link.type.toLowerCase() == 'application/atom+xml') {

                            resolve(`${ parsed[step].link.href}`)
                        }
                    }
                    options.path = '/rss/'
                    let tryRss = calledExecuter.request(options, (response) => {
                        response.on('data', (part) => {part})
                        response.on('error', (error) => {
                            let tryFeed = calledExecuter.request(options, (response) => {
                                response.on('end', () => {
                                    if (response.headers["content-type"].toLowerCase().indexOf('application/rss+xml') != -1 || response.headers["content-type"].toLowerCase().indexOf('application/atom+xml') != -1) {
                                        resolve(`${options.hostname}/feed/`)
                                    } else {
                                      resolve(false)
                                    }
                                })
                                response.on('error', (error) => {
                                    resolve(false)
                                })
                                response.on('data', (part) => { part })
                            })
                            tryFeed.end()
                        })
                        response.on('close', () => console.log('CLOSE?'))
                        response.on('end', () => {
                            if (response.headers["content-type"].toLowerCase().indexOf('application/rss+xml') != -1 || response.headers["content-type"].toLowerCase().indexOf('application/atom+xml') != -1) {
                                resolve(`${options.hostname}/rss/`)
                            } else {
                                options.path = '/feed/'
                                let tryFeed = calledExecuter.request(options, (response) => {
                                    response.on('data', (part) => { part })
                                    response.on('end', () => {
                                        if (response.headers["content-type"].toLowerCase().indexOf('application/rss+xml') != -1 || response.headers["content-type"].toLowerCase().indexOf('application/atom+xml') != -1) {
                                            resolve(`${options.hostname}/feed/`)
                                        } else {
                                            resolve(false)
                                        }
                                    })
                                    response.on('error', (error) => {
                                        resolve(false)
                                    })
                                })
                                tryFeed.end()
                            }
                        })

                    })
                    tryRss.end()

                }
            })


        })
        xmlRequest.end();

    })
  return  await prom
}

//GET URL ----> GET XML ----> UPLOAD URL ----> UPLOAD XML ----> SEND CONFIRMATION

express.post('/rss/create/', (req, res) => {//create from url and add to db
    console.log("/rss/create/ called")
    let calledExecuter = http
    var RequestUrl = ''
    var createData = ''
    var xmlData = ''
    req.on('data', (l) => {
        createData += l
    })
    let stop = false
    req.on('end', () => {
        try {
            createData = JSON.parse(createData)
            RequestUrl = _url.parse(createData.Url)
        } catch{
            res.statusCode = 400
            res.end()
            stop = true
            console.log("Wrong request")
        } finally {
            if (!stop) {
                let temp = RssLink(createData.Url)
                temp.then((value) => {
                    console.log('end of url reading')
                    if (typeof (value) === typeof ('')) {

                        if (RequestUrl.protocol == "https:")
                            calledExecuter = https


                        var mclient = new MongoClient('mongodb://localhost:27017/', { useNewUrlParser: true });
                        mclient.connect(function (err, client) {

                            let isExist = false;
                            let c = client.db("RSS")
                            let d = c.collection("RSS_URL")

                            d.find({ 'Name': { '$regex': createData.Name, $options: 'i' } }).toArray((error, out) => {
                                if (out.length == 1) {
                                    console.log(out)
                                    console.log("Already exist")
                                    mclient.close()
                                    res.statusCode = 409
                                    res.end();
                                } else {
                                    let temp = { "Name": createData.Name, "Url": createData.Url, "Category": createData.Category };

                                    let options = {
                                        hostname: RequestUrl.hostname,
                                        path: RequestUrl.path,
                                        method: "GET",
                                        headers: {
                                            'Content-Type': 'text/xml',
                                        }
                                    }

                                    let xmlRequest = calledExecuter.request(options, (response) => {

                                        response.on('error', (error) => {
                                            console.log(error.message)
                                        })
                                        response.on('data', (chunks) => {

                                            xmlData += chunks;

                                        })
                                        response.on('end', () => {
                                            console.log("XML was downloaded")

                                            d.insertOne(temp, (err, result) => {//insert url
                                                console.log("URL was inserted")
                                                if (err)
                                                    console.log(err.message)
                                                console.log(result.ops)


                                                d = c.collection("RSS_XML")

                                                let notReplaced = xmljs.toJson(xmlData)
                                                while (notReplaced.indexOf('$t') != -1)
                                                    notReplaced = notReplaced.replace('$t', '_t')
                                                let parsed = new Object()

                                                parsed.RssFile = JSON.parse(notReplaced);
                                                parsed.Name = createData.Name;
                                                parsed.Url = createData.Url
                                                parsed.Category = createData.Category
                                                d.insertOne(parsed, (err, result) => {//insert xml
                                                    console.log("XML was uploaded")
                                                    if (err)
                                                        console.log(err.message)
                                                    // console.log(result.ops)


                                                    mclient.close();
                                                    res.send("added")
                                                });
                                            });
                                        })

                                    })
                                    xmlRequest.end();

                                }
                            })

                        })


                    } else {
                        res.statusCode = 400
                        res.end()
                    }
                })
            }
        }
    })
})
express.get('/rss/show/url/', (req, res) => {//show all added url feed
    let data = []
    var mclient = new MongoClient('mongodb://localhost:27017/', { useUnifiedTopology: true, useNewUrlParser: true });
    mclient.connect(function (err, client) {
        
        
        let c = client.db("RSS")
        let d = c.collection("RSS_URL")
        let t = d.find()

        t.on('data', (dat) => {
            data.push(dat)
          
        })
        t.on('end', () => {
            console.log(data.length)
            if (data.length != 0) {
                for (var i = 0; i < data.length; i++) {
                    delete data[i]._id
                }
                res.send(data)
                mclient.close();
            } else {
                res.statusCode = 404
                res.end()
                mclient.close();
            }
           
        })
       

        
    });
})
express.get('/rss/show/all/', (req, res) => {//show all saved rss
   
    var mclient = new MongoClient('mongodb://localhost:27017/', { useUnifiedTopology: true, useNewUrlParser: true });
    mclient.connect(function (err, client) {

        let c = client.db("RSS")
        let d = c.collection("RSS_XML")
        d.find().toArray((err, result) => {

            for (var step = 0; step < result.length; step++) {
                result[step] = result[step].RssFile
            }

            let jres = JSON.stringify(result)
            while (jres.indexOf('_t') != -1)
                jres = jres.replace('_t', '$t')
         //   let resObj = JSON.parse(jres).RssFile
            res.json(jres)
         
            
            //res.end();
            mclient.close();
           
        })
    
      
    })

})
express.get('/rss/show/', (req, res) => {//show one saved rss
    try {
        let query = strQuery.parseUrl(req.url)

        let rssName = query.query.Name;
        if (rssName == "")
            throw exception
        var mclient = new MongoClient('mongodb://localhost:27017/', { useUnifiedTopology: true, useNewUrlParser: true });
        mclient.connect(function (err, client) {

            let c = client.db("RSS")
            let d = c.collection("RSS_XML")
            d.find({ 'Name': { '$regex': rssName, $options: 'i' } }).toArray((err, result) => {

                if (result.length > 0) {
                    let jres = JSON.stringify(result[0])
                    while (jres.indexOf('_t') != -1)
                        jres = jres.replace('_t', '$t')
                    let resObj = JSON.parse(jres).RssFile.rss.channel.item
                    res.json(resObj)


                    //res.end();
                    mclient.close();
                } else {
                    res.statusCode = 404
                    console.log("RSS not exist")
                    res.end()
                    mclient.close();
                }
            })



        })
    } catch{
        console.log('No name')
        res.statusCode = 400
        res.end()
    }


})
express.get('/rss/find/', (req, res) => {//find rss
    try {
    let query = strQuery.parseUrl(req.url)

    let rssName = query.query.Name;
        if (rssName == "")
            throw exception

    var mclient = new MongoClient('mongodb://localhost:27017/', { useNewUrlParser: true });
    mclient.connect(function (err, client) {
        let c = client.db("RSS")
        let d = c.collection("RSS_URL")

        d.find({ 'Name': { '$regex': rssName, $options: 'i' } }).toArray((error, result) => {

            if (result.length > 0) {
                let forSend = []  
             
                for (var step = 0; step < result.length; step++) {

                  
                        delete result[step]._id
                        forSend.push(result[step])
                   
                }
                     
                    res.send(JSON.stringify(forSend))
                    res.end();
                    mclient.close()
                    console.log("Rss finded")
                 
                  

              
            } else {
                res.statusCode = 404
                console.log("Rss is missing")
                mclient.close()
                res.end();
            }
        })


    })
    } catch{
        console.log('No name')
        res.statusCode = 400
        res.end()
    }
})
express.get('/rss/show/category/', (req, res) => {//show rss from category
    try {
    let query = strQuery.parseUrl(req.url)

    let categoryName = query.query.Category;

        if (categoryName == "")
            throw exception
  
   
 

        var mclient = new MongoClient('mongodb://localhost:27017/', { useNewUrlParser: true });
        mclient.connect(function (err, client) {
            let c = client.db("RSS")
            let d = c.collection("RSS_URL")

            d.find({ 'Category': { '$regex': categoryName, $options: 'i' } }).toArray((error, result) => {

                if (result.length > 0) {
                 
                    let forSend = []
                   
                       res.send(result)
                        res.end();
                        mclient.close()

                    
                } else {
                    res.statusCode = 404
                    console.log("Category is empty")
                    mclient.close()
                    res.end();
                }
            })

  
        })
    } catch{
        console.log('No name')
        res.statusCode = 404
        res.end()
    }
})
express.delete('/rss/delete/', (req, res) => {//delete rss feed
    try {
    let query = strQuery.parseUrl(req.url)

    let delName = query.query.Name;
        if (rssName == "")
            throw exception
  
        var mclient = new MongoClient('mongodb://localhost:27017/', { useNewUrlParser: true });
        mclient.connect(function (err, client) {

            let c = client.db("RSS")
            let d = c.collection("RSS_URL")
            d.find({ 'Name': { '$regex': delName, $options: 'i' } }, (error, result) => {

                if (!error) {
                    d.deleteOne({ 'Name': { '$regex': delName, $options: 'i' } }, (error, result) => {
                     
                        console.log('RSS link was deleted')
                        let d = c.collection("RSS_XML")
                        d.deleteOne({ 'Name': { '$regex': delName, $options: 'i' } }, (error, result) => {
                            mclient.close();
                            console.log('RSS xml was deleted')
                            res.end()
                        })
                    })
                   
                } else {
                    mclient.close();
                    res.statusCode = 404
                    res.end()
                    console.log('RSS does not exist')
                }

            })

   

    })
    } catch{
        console.log('No name')
        res.statusCode = 400
        res.end()
    }
    

})

express.listen(5000);
