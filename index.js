const axios = require("axios");
const axiosRetry = require("axios-retry");
const cheerio = require("cheerio");
const fs = require("fs");
var archiver = require("archiver");
const { MilvusClient } = require("@zilliz/milvus2-sdk-node");
const { Milvus } = require("langchain/vectorstores/milvus");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const address = "65.20.66.41:19530";
const milvusClient = new MilvusClient(address);
require('dotenv').config()

// GLOBAL VARIABLES

const arrVisitedLinks = [];

fs.mkdirSync("./download", function (err) {
  if (err) {
    console.log(err);
  } else {
    console.log("download successfully created.");
  }
});

fs.mkdir("./download/textFiles", function (err) {
  if (err) {
    console.log(err);
  } else {
    console.log("cleanDataFiles successfully created.");
  }
});

fs.mkdir("./download/pdfFiles", function (err) {
  if (err) {
    console.log(err);
  } else {
    console.log("downFile successfully created.");
  }
});

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
    if (arrVisitedLinks.includes(url) || arrVisitedLinks.length > 3) {
      return;
    }
    arrVisitedLinks.push(url);
    const trimUrl = url.split("/").slice(0, 3).join("/");
    // // console.log(trimUrl)

    const response = await axios({
      url,
      method: "get",
      timeout: 120000,
    });
    var resType = response.headers["content-type"];
    // console.log(resType);

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
        fs.writeFileSync(`./download/pdfFiles/${filename}`, res.data, {
          flag: "wx",
        });
        console.log("file downloaded ---> " + filename);

        if (arrVisitedLinks.length > 2) {
          // var archive = archiver.create("zip", {});
          // var output = fs.createWriteStream("./scraped_files.zip");
    
          // archive.pipe(output);
    
          // archive.directory("./download").finalize();
          try {
            axios.get('https://fin-gpt.slashash.dev/api/scraping/end-scraping',{timeout: 60000})
          } catch (err) {
            console.log(err)
          }
        }
        return;
      } catch (error) {
        console.log("download error---> " + error);
        throw error;
      }
    } 

    if(resType != "application/pdf" ||
    resType != "application/msword" ||
    resType != "application/vnd.ms-excel"){
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
      fs.writeFileSync(`./download/textFiles/${fileName}`, myData, (err) => {
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

      if (arrVisitedLinks.length > 2) {
        // const embeddings = new OpenAIEmbeddings({
        //   openAIApiKey: process.env.OPENAI_API_KEY, // In Node.js defaults to process.env.OPENAI_API_KEY
        // });
        // const trainAI = async function (options) {
        
        //   const loader = new TextLoader("./download/textFiles/gad-rajasthan-gov-in-codeofconduct-htm.txt");
        //   const docs = await loader.load();
        //   const vectorStore = await Milvus.fromDocuments(docs, embeddings);
        //   // return vectorStore;
        //   console.log(getCollectionStatistics(vectorStore.collectionName));
        // }

        // trainAI()
        
        // async function getCollectionStatistics(collection_name) {
        //   const res = await milvusClient.getCollectionStatistics({ collection_name });
        //   console.log(res);
        // }

        
        try {
          axios.get('https://fin-gpt.slashash.dev/api/scraping/end-scraping',{timeout: 60000})
        } catch (err) {
          console.log(err)
        }
        
      }
    }
    
  } catch (error) {
    console.error(`scrapePage:- Error scraping ${url}: ${error}`);
    // throw error;
  }
}

scrapePage("https://revenue.ie/", [""], ["p"]);

