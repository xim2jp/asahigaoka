const { chromium } = require('playwright');
const path = require('path');

async function generatePDF() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    const htmlPath = path.join(__dirname, 'guide.html');
    const pdfPath = path.join(__dirname, 'guide.pdf');

    console.log('HTMLファイルを読み込み中...');
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('PDFを生成中...');
    await page.pdf({
        path: pdfPath,
        format: 'A4',
        margin: {
            top: '20mm',
            bottom: '20mm',
            left: '15mm',
            right: '15mm'
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: '<div style="font-size:10px; text-align:center; width:100%; color:#666;">- <span class="pageNumber"></span> -</div>'
    });

    await browser.close();
    console.log('PDF生成完了！');
    console.log('出力先: ' + pdfPath);
}

generatePDF().catch(err => {
    console.error('エラー:', err);
    process.exit(1);
});
