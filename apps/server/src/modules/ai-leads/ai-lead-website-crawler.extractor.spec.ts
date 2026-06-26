import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractWebsitePageEvidence, mergeWebsitePageEvidence } from './ai-lead-website-crawler.extractor';

describe('ai lead website crawler extractor', () => {
  it('extracts contact channels and product evidence from one website page', () => {
    const page = extractWebsitePageEvidence({
      url: 'https://bearing.example.com/contact',
      loadedUrl: 'https://bearing.example.com/contact',
      statusCode: 200,
      html: `
        <html>
          <head>
            <title>Bearing Example</title>
            <meta name="description" content="Elevator traction machine bearing supplier">
          </head>
          <body>
            <a href="mailto:sales@bearing.example.com">Email sales</a>
            <a href="tel:+902163128000">Call</a>
            <a href="https://www.linkedin.com/company/bearing-example/">LinkedIn</a>
            <a href="https://api.whatsapp.com/send?phone=902163128000">WhatsApp</a>
            <a href="https://maps.google.com/?q=Bearing%20Example">Map</a>
            <a href="/about-us">About us</a>
            We supply elevator traction machine bearings, gearless motor spare parts and lift components.
          </body>
        </html>
      `
    });

    assert.deepEqual(page.emails, ['sales@bearing.example.com']);
    assert.deepEqual(page.phones, ['+902163128000']);
    assert.deepEqual(page.socialLinks, ['https://www.linkedin.com/company/bearing-example/']);
    assert.deepEqual(page.whatsappLinks, ['https://api.whatsapp.com/send?phone=902163128000']);
    assert.deepEqual(page.mapLinks, ['https://maps.google.com/?q=Bearing%20Example']);
    assert.deepEqual(page.contactLinks, ['https://bearing.example.com/about-us']);
    assert.deepEqual(page.keywordHits, [
      'bearing',
      'traction',
      'elevator',
      'lift',
      'machine',
      'motor',
      'gearless',
      'spare',
      'component',
      'supplier'
    ]);
    assert.equal(page.title, 'Bearing Example');
    assert.equal(page.description, 'Elevator traction machine bearing supplier');
    assert.match(page.evidenceSnippets.join(' '), /traction machine bearings/);
    assert.ok(page.evidenceItems.some(item => item.type === 'product' && /traction machine bearings/.test(item.text)));
    assert.ok(page.evidenceItems.every(item => item.url === 'https://bearing.example.com/contact'));
    assert.deepEqual(page.negativeKeywordHits, []);
    assert.deepEqual(page.negativeEvidenceSnippets, []);
  });

  it('extracts structured writing evidence from about, products, services, and news pages', () => {
    const pages = [
      extractWebsitePageEvidence({
        url: 'https://abc.example.com/about',
        loadedUrl: 'https://abc.example.com/about',
        statusCode: 200,
        html: '<title>About ABC</title><body>ABC Bearings is a family-owned industrial distributor serving elevator maintenance companies since 2008.</body>'
      }),
      extractWebsitePageEvidence({
        url: 'https://abc.example.com/products',
        loadedUrl: 'https://abc.example.com/products',
        statusCode: 200,
        html: '<body>Products include elevator traction machine bearings, guide rail rollers and spare parts.</body>'
      }),
      extractWebsitePageEvidence({
        url: 'https://abc.example.com/services',
        loadedUrl: 'https://abc.example.com/services',
        statusCode: 200,
        html: '<body>We support MRO replacement sourcing, maintenance teams and local repair workshops.</body>'
      }),
      extractWebsitePageEvidence({
        url: 'https://abc.example.com/news',
        loadedUrl: 'https://abc.example.com/news',
        statusCode: 200,
        html: '<body>News: ABC opened a new warehouse and expanded same-day delivery for industrial customers.</body>'
      })
    ];
    const evidence = mergeWebsitePageEvidence(pages);
    const evidenceItems = evidence.evidenceItems ?? [];

    assert.ok(evidenceItems.some(item => item.type === 'company_background' && /family-owned/.test(item.text)));
    assert.ok(evidenceItems.some(item => item.type === 'product' && /traction machine bearings/.test(item.text)));
    assert.ok(evidenceItems.some(item => item.type === 'application' && /maintenance teams/.test(item.text)));
    assert.ok(evidenceItems.some(item => item.type === 'recent_activity' && /new warehouse/.test(item.text)));
    assert.ok(evidenceItems.every(item => item.url.startsWith('https://abc.example.com/')));
    assert.ok(evidenceItems.every(item => item.text.length <= 260));
    assert.equal(evidenceItems.length <= 24, true);
  });

  it('extracts official China address and country signals from website footer text', () => {
    const page = extractWebsitePageEvidence({
      url: 'https://www.fluorined-chemical.com/others/ball-bearing/radial-load-bearings-6203-deep-groove-ball.html',
      loadedUrl:
        'https://www.fluorined-chemical.com/others/ball-bearing/radial-load-bearings-6203-deep-groove-ball.html',
      statusCode: 200,
      html: `
        <html>
          <body>
            <h1>6203 Deep Groove Ball Bearing Suppliers</h1>
            <div class="foot-con">
              العنوان:الغرفة 1102، الوحدة C، مركز Xinjing، رقم 25 طريق Jiahe، منطقة Siming، Xiamen، Fujan، الصين
            </div>
          </body>
        </html>
      `
    });

    assert.deepEqual(page.companyCountrySignals, ['中国']);
    assert.match(page.companyAddressEvidence.join(' '), /Xinjing/);
    assert.match(page.companyAddressEvidence.join(' '), /Xiamen/);
  });

  it('does not treat China brand mentions as official China company address evidence', () => {
    const page = extractWebsitePageEvidence({
      url: 'https://middle-east-bearing.example.com',
      loadedUrl: 'https://middle-east-bearing.example.com',
      statusCode: 200,
      html: `
        <html>
          <body>
            <h1>Bearings distributor in Dubai</h1>
            <section>We supply American brands, China brands, European brands and Japanese brands.</section>
            <section>One partner is the #1 bearing manufacturer in China.</section>
            <footer>Address: Jebel Ali Free Zone, Dubai, United Arab Emirates. Tel: +971 4 881 5547</footer>
          </body>
        </html>
      `
    });

    assert.deepEqual(page.companyCountrySignals, []);
    assert.doesNotMatch(page.companyAddressEvidence.join(' '), /China brands|manufacturer in China/);
  });

  it('does not treat multi-country regional network text as official China address evidence', () => {
    const page = extractWebsitePageEvidence({
      url: 'https://www.ntn.com.sg/about-us/',
      loadedUrl: 'https://www.ntn.com.sg/about-us/',
      statusCode: 200,
      html: `
        <html>
          <body>
            <h1>About NTN Singapore</h1>
            <section>
              Across Asia, NTN meets regional needs with value-added products and localized operations in China,
              South Korea, Singapore, Thailand, and India.
            </section>
            <footer>Address: 9 Clementi Loop, Singapore. Tel: (65) 64698066</footer>
          </body>
        </html>
      `
    });

    assert.deepEqual(page.companyCountrySignals, []);
    assert.doesNotMatch(page.companyAddressEvidence.join(' '), /localized operations in China/);
  });

  it('does not classify regular company domains containing x.com as social links', () => {
    const page = extractWebsitePageEvidence({
      url: 'https://vwimpex.com',
      loadedUrl: 'https://vwimpex.com',
      statusCode: 200,
      html: `
        <html>
          <body>
            <a href="https://vwimpex.com/about-us">About us</a>
            <a href="https://x.com/VWIMPEX">X profile</a>
          </body>
        </html>
      `
    });

    assert.deepEqual(page.socialLinks, ['https://x.com/VWIMPEX']);
  });

  it('merges page evidence into one compact website evidence record', () => {
    const evidence = mergeWebsitePageEvidence([
      {
        url: 'https://bearing.example.com',
        loadedUrl: 'https://bearing.example.com',
        statusCode: 200,
        title: 'Home',
        description: 'Bearing supplier',
        emails: ['sales@bearing.example.com'],
        phones: ['+902163128000'],
        socialLinks: [],
        whatsappLinks: [],
        mapLinks: [],
        contactLinks: ['https://bearing.example.com/contact'],
        keywordHits: ['bearing', 'elevator'],
        evidenceSnippets: ['Bearing supplier for elevator projects'],
        evidenceItems: [
          {
            type: 'product',
            url: 'https://bearing.example.com',
            text: 'Bearing supplier for elevator projects'
          }
        ],
        companyAddressEvidence: [],
        companyCountrySignals: [],
        negativeKeywordHits: [],
        negativeEvidenceSnippets: []
      },
      {
        url: 'https://bearing.example.com/contact',
        loadedUrl: 'https://bearing.example.com/contact',
        statusCode: 200,
        title: 'Contact',
        description: '',
        emails: ['sales@bearing.example.com', 'export@bearing.example.com'],
        phones: ['+902163128000'],
        socialLinks: ['https://www.linkedin.com/company/bearing-example/'],
        whatsappLinks: ['https://wa.me/902163128000'],
        mapLinks: ['https://maps.google.com/?q=Bearing'],
        contactLinks: ['https://bearing.example.com/contact'],
        keywordHits: ['bearing', 'traction'],
        evidenceSnippets: ['Traction machine bearing stock'],
        evidenceItems: [
          {
            type: 'product',
            url: 'https://bearing.example.com/contact',
            text: 'Traction machine bearing stock'
          },
          {
            type: 'negative_relevance',
            url: 'https://bearing.example.com/contact',
            text: 'School maintenance team only'
          }
        ],
        companyAddressEvidence: ['Address: 10 Bearing Street, Istanbul, Turkey'],
        companyCountrySignals: ['土耳其'],
        negativeKeywordHits: ['school'],
        negativeEvidenceSnippets: ['School maintenance team only']
      }
    ]);

    assert.deepEqual(evidence, {
      crawlStatus: 'completed',
      pageCount: 2,
      finalUrl: 'https://bearing.example.com',
      title: 'Home',
      description: 'Bearing supplier',
      emails: ['sales@bearing.example.com', 'export@bearing.example.com'],
      phones: ['+902163128000'],
      socialLinks: ['https://www.linkedin.com/company/bearing-example/'],
      whatsappLinks: ['https://wa.me/902163128000'],
      mapLinks: ['https://maps.google.com/?q=Bearing'],
      contactLinks: ['https://bearing.example.com/contact'],
      keywordHits: ['bearing', 'elevator', 'traction'],
      evidenceSnippets: ['Bearing supplier for elevator projects', 'Traction machine bearing stock'],
      evidenceItems: [
        {
          type: 'product',
          url: 'https://bearing.example.com',
          text: 'Bearing supplier for elevator projects'
        },
        {
          type: 'product',
          url: 'https://bearing.example.com/contact',
          text: 'Traction machine bearing stock'
        },
        {
          type: 'negative_relevance',
          url: 'https://bearing.example.com/contact',
          text: 'School maintenance team only'
        }
      ],
      companyAddressEvidence: ['Address: 10 Bearing Street, Istanbul, Turkey'],
      companyCountrySignals: ['土耳其'],
      negativeKeywordHits: ['school'],
      negativeEvidenceSnippets: ['School maintenance team only'],
      failureReason: null
    });
  });
});
