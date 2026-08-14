import prisma from "./src/db.js";

async function main() {
  console.log("Seeding all major Pakistani universities...");

  const universities = [
    { name: "NUST", location: "Islamabad", logoUrl: "/uni-logos/Updated Uni logos/nust-seeklogo.png", tests: [
      { name: "NET Series 1", examDate: new Date("2026-09-15T09:00:00Z") },
      { name: "NET Series 2", examDate: new Date("2026-11-10T09:00:00Z") },
      { name: "NET Series 3", examDate: new Date("2027-01-12T09:00:00Z") },
      { name: "NET Series 4", examDate: new Date("2027-03-15T09:00:00Z") },
    ]},
    { name: "FAST NUCES", location: "Lahore / Islamabad / Karachi", logoUrl: "/uni-logos/Updated Uni logos/Fast-University-Logo.png", tests: [
      { name: "FAST Entry Test", examDate: new Date("2026-07-20T09:00:00Z") },
    ]},
    { name: "UET Lahore", location: "Lahore, Punjab", logoUrl: "/uni-logos/Updated Uni logos/uet-lahore-seeklogo.png", tests: [
      { name: "ECAT", examDate: new Date("2026-08-25T09:00:00Z") },
    ]},
    { name: "GIKI", location: "Topi, KPK", logoUrl: "/uni-logos/giki.png", tests: [
      { name: "GIKI Entry Test", examDate: new Date("2026-08-10T09:00:00Z") },
    ]},
    { name: "COMSATS", location: "Islamabad / Lahore / Abbottabad", logoUrl: "/uni-logos/Updated Uni logos/comsats-university-islamabad-seeklogo.png", tests: [
      { name: "NTS NAT", examDate: new Date("2026-09-01T09:00:00Z") },
    ]},
    { name: "PIEAS", location: "Islamabad", logoUrl: "/uni-logos/Updated Uni logos/PIEAS.jpeg", tests: [
      { name: "PIEAS Entry Test", examDate: new Date("2026-08-18T09:00:00Z") },
    ]},
    { name: "NED University", location: "Karachi, Sindh", logoUrl: "/uni-logos/Updated Uni logos/ned-university-of-engineering-technolo-seeklogo.png", tests: [
      { name: "NED Entry Test", examDate: new Date("2026-08-05T09:00:00Z") },
    ]},
    { name: "UHS / PMDC", location: "National", logoUrl: "/uni-logos/Updated Uni logos/uhs-seeklogo.png", tests: [
      { name: "National MDCAT", examDate: new Date("2026-09-22T09:00:00Z") },
    ]},
    { name: "NUMS", location: "Rawalpindi", logoUrl: "/uni-logos/Updated Uni logos/Nums University.jpeg", tests: [
      { name: "NUMS Entry Test", examDate: new Date("2026-09-05T09:00:00Z") },
    ]},
    { name: "Agha Khan University", location: "Karachi", logoUrl: "/uni-logos/Updated Uni logos/the-aga-khan-university-seeklogo.png", tests: [
      { name: "AKU Aptitude Test", examDate: new Date("2026-10-15T09:00:00Z") },
    ]},
    { name: "KMU (ETEA)", location: "Peshawar, KPK", logoUrl: "/uni-logos/Updated Uni logos/kmc-seeklogo.png", tests: [
      { name: "ETEA Medical Test", examDate: new Date("2026-09-12T09:00:00Z") },
    ]},
    { name: "LUMS", location: "Lahore", logoUrl: "/uni-logos/lums.png", tests: [
      { name: "LCAT (LUMS Common Admission Test)", examDate: new Date("2026-08-30T09:00:00Z") },
    ]},
    { name: "IBA Karachi", location: "Karachi, Sindh", logoUrl: "/uni-logos/iba.png", tests: [
      { name: "IBA Admission Test", examDate: new Date("2026-08-28T09:00:00Z") },
    ]},
    { name: "Punjab University (PU)", location: "Lahore", logoUrl: "/uni-logos/Updated Uni logos/university-of-the-punjab-seeklogo.png", tests: [
      { name: "PU Entry Test", examDate: new Date("2026-09-08T09:00:00Z") },
    ]},
  ];

  for (const uni of universities) {
    const { tests, ...uniData } = uni;
    const created = await prisma.university.upsert({
      where: { name: uni.name },
      update: { logoUrl: uni.logoUrl, location: uni.location },
      create: { ...uniData },
    });

    for (const test of tests) {
      const existing = await prisma.entryExam.findFirst({
        where: { name: test.name, universityId: created.id }
      });
      if (!existing) {
        await prisma.entryExam.create({
          data: { ...test, universityId: created.id, status: 'PUBLISHED' }
        });
      }
    }
    console.log(`✅ ${uni.name}`);
  }

  console.log("\n🎉 All universities seeded!");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
