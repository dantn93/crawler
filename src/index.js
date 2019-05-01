const request = require('request');
const cheerio = require('cheerio');
const fastcsv = require('fast-csv');  
const fs = require('fs');
var express = require('express');
var app = express();

function parseDateTime (timeString) {
  try {
    const dateTime = timeString.split(',');
    if (dateTime.length === 3) {
      //parse date
      let date = dateTime[1];
      date = date.replace(' ', '');
      const parseDate = date.split('/');
      date = parseDate[2] + '-' + parseDate[1] + '-' + parseDate[0];
      
      //parse time
      let time = dateTime[2];
      time = time.replace(' ', '');
      const parseTime = time.split('(');
      if (parseTime.length > 1) {
        time = parseTime[0];
      } else {
        time = null;
      }
      return date + ' ' + time;
    }
    return null;
  } catch (error) {
    return null;
  }
}

function parseTitle (title) {
  try {
    let des = title.replace('\t', '');
    des = des.replace('\n', '');
    return des;
  } catch (error) {
    return null;
  }
}

function parseHtml (html) {
  try {
    let des = html.replace('?cvar=A', '');
    if (!(des.includes('https://vnexpress.net/bong\-da/') || des.includes('https://vnexpress.net/the\-thao/')) || des.includes('#box_comment')) {
      return null;
    }
    return des;
  } catch (error) {
    return null;
  }
}


async function crawData (URL, step) {
  const data = await new Promise( async function(resolve, reject) {
    try {
      request(URL, async function (err, res, body) {
        if(err)
        {
            console.log(err, "error occured while hitting URL");
        } else {
          let currentURL = '';
          let currenttitle = '';
          let currentAuthor = '';
          let currentDate = '';
          let listArticle = [];
          let $ = cheerio.load(body);  //loading of complete HTML body
          //1. URL
          $('head > meta ').each(function(i, e) {
            const meta_list = $(this).attr('name');
            if (meta_list === 'its_url') {
              currentURL = $(this).attr('content');
            }
          });
    
          //2. Title
          // $('h1.title_news_detail').each(function(i, e) {
          $('h1').each(function(i, e) {
            currenttitle = parseTitle($(this).text());
          });
    
          //3. Author
          $('strong', 'p').each(function(i, e) {
            currentAuthor = $(this).text();
          });
    
          //4. Date
          $('header > span').each(function(i, e) {
            currentDate = parseDateTime($(this).text());
          });
          
          //5. Get child-links
          if (step === 0) {
            resolve({
              url: currentURL,
              title: currenttitle,
              author: currentAuthor,
              date: currentDate
            });
          } else {
            var alist = [];
            //push the current data
            alist.push({
              url: currentURL,
              title: currenttitle,
              author: currentAuthor,
              date: currentDate
            });

            //push childrent
            const aObject = await $('a', 'h4').each(function(i, e) {});
            for (let i = 0; i < aObject.length; i++) {
              const element = aObject[i.toString()];
              const link = parseHtml(element.attribs.href);
              if (link) {
                const nextStep = step - 1;
                const promiseObj = await crawData(link, nextStep);
                alist.push(promiseObj);
              }
            }
            resolve(alist);
          }
        }
      });
    } catch (error) {
      reject(error.message);
    }
  });
  return data;
  
}

app.get('/', async function (req, res) {
  const URL = 'https://vnexpress.net/bong-da/pogba-toi-duoc-tra-tien-khong-phai-de-khua-moi-mua-mep-3916742.html';
  const data = await crawData(URL, 1);
  const ws = fs.createWriteStream("out.csv", {encoding: "utf8"});  
  fastcsv
    .write(data, { headers: true })
    .pipe(ws);
  res.send('Wrote into file out.csv!');
});

app.listen(3000, function () {
  console.log('Server is listening on port 3000!');
});