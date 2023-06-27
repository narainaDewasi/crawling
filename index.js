const axios = require("axios");
const axiosRetry = require("axios-retry");
const cheerio = require("cheerio");
const fs = require("fs");
var archiver = require("archiver");

// GLOBAL VARIABLES

const arrVisitedLinks = [];

fs.mkdir("./cleanDataFiles", function(err) {
  if (err) {
    console.log(err)
  } else {
    console.log("cleanDataFiles successfully created.")
  }
})

fs.mkdir("./downFile", function(err) {
  if (err) {
    console.log(err)
  } else {
    console.log("downFile successfully created.")
  }
})

axiosRetry(axios, {
  retryDelay: (retryCount = 5) => {
    return retryCount * 100;
  },
  onRetry: (retryCount = 5, error) => {
    if (error) console.log("AXIOS RETRY ERROR => " + error);
    console.log("AXIOS RETRY OCCURED");
  },
});

async function scrapePage(url, parentTagClass, tags) {
  try {
    if (arrVisitedLinks.includes(url) || arrVisitedLinks.length > 200) {
      return;
    }
    arrVisitedLinks.push(url);
    const trimUrl = url.split("/").slice(0, 3).join("/");
    // console.log(trimUrl)

    const response = await axios({
      url,
      method: "get",
      timeout: 120000,
    });
    var resType = response.headers["content-type"];
    console.log(resType);

    if (
      resType == "application/pdf" ||
      resType == "application/msword" ||
      resType == "application/vnd.ms-excel"
    ) {
      console.log("PDF url----> " + url);
      try {
        res = await axios({
          url,
          responseType: "arraybuffer",
        });
        var filename = url.split("/").slice(3).toString().replaceAll(",", "-");
        fs.writeFileSync(`./downFile/${filename}`, res.data, {
          flag: "wx",
        });
        console.log("file downloaded ---> " + filename);

        if (arrVisitedLinks.length > 199) {
          var archive = archiver.create("zip", {});
          var output = fs.createWriteStream('./zipPDF.zip');

          archive.pipe(output);

          archive
            .directory('./downFile')
            .finalize();

            fs.rmdir("./downFile", (err) => {
              if(err){
                console.log('downFile delete error --> '+ err)
              }
              console.log("Folder Deleted!");
             
            });
        }

        return;
      } catch (error) {
        console.log("download error---> " + error);
        throw error;
      }
    } else {
      const allTags = "" + tags;
      console.log("axios url---> " + url);

      var trimedData = response.data;
      trimedData = trimedData.replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        " "
      ); //remove scipt tags
      trimedData = trimedData.replace(/(<!--[\s\S]*?-->)/g, ""); //remove comments
      trimedData = trimedData.replace(
        /<div\b[^>]*\bstyle\s*=\s*(["'])[^>]*display\s*:\s*none[^>]*\1[^>]*>[\s\S]*?<\/div>/gi,
        ""
      ); //remove div with display none

      var $ = cheerio.load(trimedData); // load data in cheerio variable $

      // removing unnecessary text (for revenue.ie)
      $("#pageFeedbackTarget").remove();
      $('p:contains("Published:")').remove();
      // $('a:contains("Next:")').remove();
      // $('a:contains("Print all pages")').remove();

      const pageContent = [];

      parentTagClass.forEach((e) => {
        pageContent.push(
          $(`${e} ${allTags}`)
            .get()
            .map((el) => $(el).text().trim())
            .join(` `)
        );
      });

      var myData = pageContent.toString();
      // .toLowerCase().replaceAll(',', '').replaceAll('.', '')
      // myData = myData.replace(/\b(a|an|the|and|but|or|in|on|at|is|of|to)\b/gi, '') // remove stop words
      // myData = myData.replace(/[\r\n]+| {2,}/g, ' ')
      myData = myData.replace(/^\s+|\s+$/gm, ""); // remove space
      myData = myData.replace(/($)/, " ");

      var fName = url.split("/").slice(2);
      fName = fName.toString().replace(/[,.=?]/g, "-");

      const fileName = `${fName}.txt`;

      // write files
      fs.writeFileSync(`./cleanDataFiles/${fileName}`, myData, (err) => {
        if (err) {
          console.log("write file" + err);
          // throw err
        }
      });

      console.log("WRITE FILE---> " + fileName);

      // Get all the links on the page and recursively scrape them

      const links = $("a");
      links.each((index, element) => {
        var href = $(element).attr("href");
        href = new URL(href, url).href;
        if (href && href.startsWith(trimUrl)) {
          const absoluteUrl = href;
          scrapePage(absoluteUrl, parentTagClass, tags);
        }
      });
      if (arrVisitedLinks.length > 199) {
        var archive = archiver.create("zip", {});
        var output = fs.createWriteStream('./zipTXT.zip');

        archive.pipe(output);

        archive
          .directory('./cleanDataFiles')
          .finalize();

          fs.rmdir("./cleanDataFiles", (err) => {
            if(err){
              console.log('downFile delete error --> '+ err)
            }
            console.log("Folder Deleted!");
           
          });
      }
    }
  } catch (error) {
    console.error(`scrapePage:- Error scraping ${url}: ${error}`);
    // throw error;
  }
}

scrapePage("https://gad.rajasthan.gov.in/", [""], ["p"]);

console.log("hello");
