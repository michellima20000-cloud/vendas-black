import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'admin@vendasblack.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'Admin@123';

  // 1. Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      password: await bcrypt.hash(superAdminPassword, 10),
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
    },
  });
  console.log('✅ Super Admin:', superAdmin.email);

  // 2. Loja demo + dono
  const ownerEmail = 'dono@vendasblack.com';
  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      email: ownerEmail,
      password: await bcrypt.hash('Dono@123', 10),
      name: 'Maria Silva',
      role: Role.STORE_OWNER,
      phone: '(11) 99999-0000',
    },
  });

  const store = await prisma.store.upsert({
    where: { slug: 'atelier-maria' },
    update: {},
    create: {
      slug: 'atelier-maria',
      name: 'Ateliê Maria',
      description: 'Peças artesanais exclusivas feitas à mão',
      about:
        'O Ateliê Maria nasceu do amor por peças únicas. Cada item é produzido artesanalmente, com materiais selecionados e muito carinho.',
      instagram: '@atelieriemaria',
      whatsapp: '5511999990000',
      couponCode: 'BEMVINDA10',
      couponValue: 10,
      ownerId: owner.id,
      theme: {
        create: {
          primaryColor: '#B07A85',
          accentColor: '#F4A3BA',
          bgColor: '#FFF1F5',
          fontTitle: 'Playfair Display',
          fontBody: 'Nunito',
        },
      },
      howToBuy: {
        create: [
          { step: 1, icon: 'shopping-bag', title: 'Escolha suas peças', subtitle: 'Navegue pelo catálogo e adicione ao carrinho' },
          { step: 2, icon: 'message-circle', title: 'Finalize pelo WhatsApp', subtitle: 'Seu pedido é enviado direto para nosso atendimento' },
          { step: 3, icon: 'credit-card', title: 'Pague com segurança', subtitle: 'Pix, cartão ou boleto — como preferir' },
          { step: 4, icon: 'package', title: 'Receba em casa', subtitle: 'Enviamos para todo o Brasil com código de rastreio' },
        ],
      },
    },
  });
  console.log('✅ Loja demo:', store.slug);

  // 3. Categorias
  const categoryNames: Array<[string, string]> = [
    ['Colares', 'colares'],
    ['Brincos', 'brincos'],
    ['Bolsas', 'bolsas'],
  ];
  const categories: Record<string, string> = {};
  for (const [name, slug] of categoryNames) {
    const category = await prisma.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug } },
      update: {},
      create: { storeId: store.id, name, slug },
    });
    categories[slug] = category.id;
  }
  console.log('✅ Categorias criadas');

  // 4. Produtos
  const products = [
    {
      name: 'Colar Pedra Natural',
      description: 'Colar artesanal com pedra natural polishada e fecho banhado a ouro 18k.',
      price: 89.9,
      comparePrice: 119.9,
      stock: 15,
      installments: 3,
      categorySlug: 'colares',
      images: ['/uploads/demo/colar-pedra-natural.jpg'],
      variations: [
        { type: 'Cor da pedra', value: 'Rosa', stock: 8 },
        { type: 'Cor da pedra', value: 'Verde', stock: 7 },
      ],
    },
    {
      name: 'Brinco Argola Torcida',
      description: 'Argolas médias com detalhe torcido, acabamento acetinado. Leves e confortáveis.',
      price: 45.0,
      comparePrice: null,
      stock: 30,
      installments: 2,
      categorySlug: 'brincos',
      images: ['/uploads/demo/brinco-argola-torcida.jpg'],
      variations: [
        { type: 'Banho', value: 'Dourado', stock: 15 },
        { type: 'Banho', value: 'Prateado', stock: 15 },
      ],
    },
    {
      name: 'Bolsa de Palha Bordada',
      description: 'Bolsa de palha com bordado floral feito à mão. Alça de couro sintético.',
      price: 159.9,
      comparePrice: 199.9,
      stock: 8,
      installments: 4,
      categorySlug: 'bolsas',
      images: ['/uploads/demo/bolsa-palha-bordada.jpg'],
      variations: [],
    },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({
      where: { storeId: store.id, name: p.name },
    });
    if (existing) continue;
    await prisma.product.create({
      data: {
        storeId: store.id,
        categoryId: categories[p.categorySlug],
        name: p.name,
        description: p.description,
        price: p.price,
        comparePrice: p.comparePrice,
        images: p.images,
        stock: p.stock,
        installments: p.installments,
        isActive: true,
        variations: { create: p.variations },
      },
    });
  }
  console.log('✅ Produtos criados');

  // 5. Depoimento aprovado
  const testimonialExists = await prisma.testimonial.findFirst({
    where: { storeId: store.id, author: 'Juliana P.' },
  });
  if (!testimonialExists) {
    await prisma.testimonial.create({
      data: {
        storeId: store.id,
        author: 'Juliana P.',
        text: 'Peças lindas e de ótima qualidade! O atendimento foi super atencioso e a entrega chegou antes do prazo.',
        rating: 5,
        approved: true,
      },
    });
    console.log('✅ Depoimento criado');
  }

  // 6. Cliente demo
  const customerEmail = 'cliente@vendasblack.com';
  await prisma.user.upsert({
    where: { email: customerEmail },
    update: {},
    create: {
      email: customerEmail,
      password: await bcrypt.hash('Cliente@123', 10),
      name: 'Ana Cliente',
      role: Role.CUSTOMER,
    },
  });
  console.log('✅ Cliente demo:', customerEmail);

  console.log('\n🎉 Seed concluído!');
  console.log(`   Super Admin: ${superAdminEmail} / ${superAdminPassword}`);
  console.log(`   Dono da loja: ${ownerEmail} / Dono@123`);
  console.log(`   Cliente: ${customerEmail} / Cliente@123`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
