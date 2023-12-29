import { writeFile } from "node:fs/promises";
import { createWriteStream, unlink } from "node:fs";
import { resolve } from "node:path";
import https from "node:https";
import puppeteer from "puppeteer";

const urls = [
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/serie-30",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/T3F",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/t4",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/t4-75s",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/t5-110-s",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/t6",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/t6-methane-power",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/t7-lwb",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/t8-plm-intelligence",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/t9-plm-intelligence",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/tk4",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/tl5",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/tl5-acess%C3%ADvel",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/tt-e-ttf",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/tl/tt4",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/colheitadeiras/cr",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/colheitadeiras/tc",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/colheitadeiras/tx",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/plataformas/plataforma-draper",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/plataformas/plataforma-rigida",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/plataformas/plataforma-superflex",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/plataformas/plataforma-de-milho",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/pulverizadores/DEFENSOR%202500",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/pulverizadores/DEFENSOR%202500%20CANA",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/pulverizadores/defensor-3500-hc",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/semeadoras/pl6000",
  "https://agriculture.newholland.com/lar/pt-br/equipamento/produtos/semeadoras/pl7000",
];

const downloadImage = async (url, filename) => {
  return new Promise((res, rej) => {
    const file = createWriteStream(resolve(`./output/images/${filename}`));

    https.get(url, (response) => {
      response.pipe(file);

      response.on("error", (err) => {
        unlink(resolve(`./output/images/${filename}`));

        rej(err);
      });
      response.on("end", () => {
        file.close();

        res(`./output/images/${filename}`);
      });
    });
  });
};

const getFilename = (url) => url.split(/\//).at(-1);

const getName = async (page) => {
  return await page.$eval("#ctl00_PlaceHolderMain_SeriesTopInformation .title", (el) => el.textContent);
};

const getFeatures = async (page) => {
  return await page.$$eval("#ctl00_PlaceHolderMain_SeriesTopInformation div.arrow.block.d12", (els) =>
    els.map((el) => ({
      title: el.querySelector("h3")?.textContent,
      description: el.querySelector("p")?.textContent,
    }))
  );
};

const getGallery = async (page) => {
  const urls = await page.$$eval('#ctl00_PlaceHolderMain_SeriesTopInformation div.slideshow-content a[href^="//assets.cnhindustrial.com"]', (els) => els.map((el) => el?.href));

  return await Promise.all(urls.map((url) => downloadImage(url, getFilename(url))));
};

const getOverviewTop = async (page) => {
  return await page.$eval("#ctl00_PlaceHolderMain_EditModePropertiesTop_TopContent__ControlWrapper_RichHtmlField", (el) =>
    el.textContent
      .trim()
      .replace(/\u00a0|\u200b/g, "")
      .replace(/\n$/, "")
  );
};

const getOverviewArticles = async (page) => {
  const items = await page.$$eval("article.block.d24.line", (els) =>
    els.map((el) => ({
      title: el.querySelector("div.text h3.title")?.textContent,
      text: el.querySelector("div.text p")?.textContent,
      image: el.querySelector('img[src^="//assets.cnhindustrial.com"]')?.src,
    }))
  );

  return await Promise.all(
    items.map(async ({ title, text, image }) => ({
      title,
      text,
      image: image ? await downloadImage(image, getFilename(image)) : undefined,
    }))
  );
};

const getModels = async (page) => {
  const modelsPageUrl = await page.$eval('nav.secondNav a[href$="modelos"]', (el) => el.href).catch((err) => {});
  if (!modelsPageUrl) return;

  await page.goto(modelsPageUrl);

  const items = await page.$$eval("div.card.scheda-mod", (els) =>
    els.map((el) => {
      const attributes = Array.from(el.querySelectorAll("table.model-table > tbody > tr")).reduce((agg, td) => {
        const key = td.querySelector("td:nth-child(1)")?.textContent;
        const val = td.querySelector("td:nth-child(2)")?.textContent;

        return { ...agg, [key]: val };
      }, {});

      return {
        name: el.querySelector("h3.text-title")?.textContent,
        image: el.querySelector('img[src^="//assets.cnhindustrial.com"]')?.src,
        attributes,
      };
    })
  );

  return await Promise.all(
    items.map(async ({ name, image, attributes }) => ({
      name,
      image: image ? await downloadImage(image, getFilename(image)) : undefined,
      attributes,
    }))
  );
};

const getSpecifications = async (page) => {
  const specificationsPageUrl = await page.$eval('nav.secondNav a[href$="cnicas"]', (el) => el.href).catch((err) => {});
  if (!specificationsPageUrl) return;

  await page.goto(specificationsPageUrl);

  return await page.$$eval("div.multi-trigger.text", (els) =>
    els.map((el) => {
      const cols = Array.from(el.nextElementSibling.querySelectorAll("div.tableCont table thead th")).map((th) => th.textContent);
      const rows = Array.from(el.nextElementSibling.querySelectorAll("div.tableCont table tbody tr")).map((tr) =>
        Array.from(tr.querySelectorAll("td.cell")).map((td) => td.textContent)
      );
      const values = Array.from(el.nextElementSibling.querySelectorAll("div.headcol table > tbody > tr > td:nth-child(1)")).map((td) => td.textContent);

      return {
        item: el.textContent.replace(/\n$/, ""),
        attributes: values.map((value, idxValue) => ({
          name: value,
          models: cols.map((col, idxCol) => ({
            name: col,
            value: rows[idxValue]?.[idxCol],
          })),
        })),
      };
    })
  );
};

async function main() {
  const browser = await puppeteer.launch({ headless: process.env.BROWSER_HEADLESS ?? false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1024 });

  const results = [];

  for (const url of urls) {
    await page.goto(url, { waitUntil: "networkidle2" });

    const result = {};

    result.name = await getName(page);
    result.features = await getFeatures(page);
    result.gallery = await getGallery(page);
    result.overviewTop = await getOverviewTop(page);
    result.overviewArticles = await getOverviewArticles(page);
    result.models = await getModels(page);
    result.specifications = await getSpecifications(page);

    results.push(result);
  }

  await browser.close();

  await writeFile(resolve("./output/products.json"), JSON.stringify(results, undefined, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
