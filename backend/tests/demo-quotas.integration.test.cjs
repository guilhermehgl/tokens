const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
process.env.DOTENV_CONFIG_PATH = require('node:path').join(__dirname, 'no-real-environment.env');
process.env.JWT_SECRET = 'isolated-quota-tests-only-00000000000000000';
process.env.TRUST_PROXY = 'loopback'; // Somente fixture HTTP local; não modifica infraestrutura.
const app = require('../dist/src/app').default;
const User = require('../dist/src/models/User').default;
const { Company } = require('../dist/src/models/Company');
const Token = require('../dist/src/models/Token').default;
const Audit = require('../dist/src/models/AuditLog').default;
const { demoWrite, readDemoLimits, demoDay } = require('../dist/src/demo/quotas');
const { demoEnabled, testEmail, confirmDemoEnvironment } = require('../dist/src/demo/environment');
const { createUniqueToken } = require('../dist/src/services/token.service');
const { hashToken } = require('../dist/src/utils/tokenUtils');
const { publishedDemoEmails } = require('../dist/src/demo/accounts');
const password = 'VisitorTest!2026';

 test('demonstração explícita: autorização, capacidade e transações reais', { timeout: 300000 }, async t => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.MONGO_URI = mongo.getUri('quotas_demo');
  process.env.DEMO_ENABLED = 'true'; process.env.DEMO_DB_NAME = 'quotas_demo'; process.env.DEMO_DB_HOST = '127.0.0.1';
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.db.collection('demo_environment').insertOne({_id:'portal-tokens-demo-v1',purpose:'public-demo'});
  await confirmDemoEnvironment();
  await User.init(); await Company.init(); await Token.init(); await Audit.init();
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve=>server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const originalFetch=global.fetch; t.mock.method(global,'fetch',(url,options)=>{assert.ok(String(url).startsWith(origin+'/'),'Conexão externa proibida');return originalFetch(url,options);});
  const mail = t.mock.method(require('nodemailer'),'createTransport',()=>{throw new Error('Envio SMTP proibido');});
  let ip=1, fixed, company;
  const sessionFor = user => jwt.sign({id:String(user._id),role:user.role},process.env.JWT_SECRET,{expiresIn:'1h'});
  const api=async(path,{actor=fixed?.admin,body,method=body?'POST':'GET'}={})=>{
    const response=await fetch(origin+'/api'+path,{method,headers:{'X-Forwarded-For':`192.0.2.${(ip++%240)+1}`,...(actor?{Authorization:'Bearer '+(typeof actor==='string'?actor:sessionFor(actor))}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,data:await response.json(),headers:response.headers};
  };
  async function reset() {
    await User.deleteMany({});await Company.deleteMany({});await Token.deleteMany({});await Audit.deleteMany({});await mongoose.connection.db.collection('demoquotas').deleteMany({});
    const hashed=await bcrypt.hash('123$qwer',4);
    fixed={};for(const [i,role] of ['admin','vendedor','verificador'].entries()) fixed[role]=await User.create({nome:role,email:publishedDemoEmails[i],password:hashed,role});
    company=await Company.create({razaoSocial:'Empresa inicial',documento:'00000000000001',tipoDocumento:'CNPJ',emailReferencia:'initial@example.test',telefone:'+5511999999999'});
  }
  const createUser=(email,role='vendedor',extra={})=>api('/auth/create',{body:{nome:'Visitante teste',email,password,role,...extra}});
  const companyBody=i=>({razaoSocial:'Empresa teste '+i,documento:String(10000000000000+i),tipoDocumento:'CNPJ',emailReferencia:`company${i}@example.test`,telefone:'+5511999999999'});
  const generate=(actor=fixed.vendedor,channel='screen')=>api('/tokens/generate',{actor,body:{companyId:String(company._id),nfNumber:'000000101',deliveryChannel:channel}});
  const rawUser=i=>({nome:'Legado '+i,email:`legacy${i}@example.test`,role:'vendedor',password:'not-an-authenticated-fixture'});
  await reset();

  await t.test('banco sem marcador não é ativado por variáveis, confirmação é somente leitura',async()=>{
    await mongoose.connection.db.collection('demo_environment').deleteMany({});
    await mongoose.disconnect();await mongoose.connect(process.env.MONGO_URI);
    await assert.rejects(confirmDemoEnvironment());assert.throws(()=>demoEnabled());
    assert.equal(await mongoose.connection.db.collection('demo_environment').countDocuments(),0);
    await mongoose.connection.db.collection('demo_environment').insertOne({_id:'portal-tokens-demo-v1',purpose:'public-demo'});await confirmDemoEnvironment();
  });
  await t.test('host e banco exatos, configuração parcial recusada e domínio fictício',()=>{
    assert.equal(demoEnabled(),true);process.env.DEMO_DB_HOST='outro.mongodb.net';assert.throws(()=>demoEnabled());process.env.DEMO_DB_HOST='127.0.0.1';
    process.env.DEMO_DB_NAME='test';assert.throws(()=>demoEnabled());process.env.DEMO_DB_NAME='quotas_demo';
    assert.equal(testEmail('visitor@example.test'),true);assert.equal(testEmail('visitor@team.example'),true);assert.equal(testEmail('visitor@example.com'),false);
  });
  let created;
  await t.test('admin público cria vendedor/verificador, sem privilégios administrativos e com auditoria',async()=>{
    const seller=await createUser('seller@example.test');assert.equal(seller.status,201);created=await User.findById(seller.data.user.id);
    assert.equal(created.demoManaged,true);assert.equal(created.isDemo,true);assert.notEqual(created.password,password);
    assert.equal((await createUser('checker@example.test','verificador')).status,201);
    assert.equal((await createUser('admin@example.test','admin')).status,400);
    assert.equal((await createUser('real@example.com')).status,400);
    assert.equal((await createUser('flags@example.test','vendedor',{demoManaged:false,isDemo:false})).status,400);
    assert.equal(await Audit.countDocuments({action:'CREATE_USER'}),2);
  });
  await t.test('usuário criado faz login, edita dados e recebe senha nova, sem auditoria sensível',async()=>{
    let result=await api('/auth/login',{actor:null,body:{email:created.email,password}});assert.equal(result.status,200);assert.equal(result.data.user.demoEnvironment,true);
    assert.equal((await api('/users/'+created.id,{method:'PUT',body:{name:'Visitante editado',email:'edited@example.test',role:'verificador'}})).status,200);
    assert.equal((await api('/users/'+created.id+'/reset-password',{method:'PUT',body:{newPassword:'ChangedVisitor!2026'}})).status,200);
    result=await api('/auth/login',{actor:null,body:{email:'edited@example.test',password:'ChangedVisitor!2026'}});assert.equal(result.status,200);assert.equal(result.data.user.role,'verificador');
    assert.equal((await api('/auth/login',{actor:null,body:{email:'edited@example.test',password}})).status,401);
    const logs=JSON.stringify(await Audit.find().lean());assert.doesNotMatch(logs,/ChangedVisitor|VisitorTest|123\$qwer|tokenHash/);
  });
  await t.test('três identidades fixas, usuários fora do escopo e escalada permanecem protegidos',async()=>{
    for(const target of Object.values(fixed)) {
      assert.equal((await api('/users/'+target.id,{method:'PUT',body:{name:'Outra pessoa'}})).status,403);
      assert.equal((await api('/users/'+target.id,{method:'DELETE'})).status,403);
      assert.equal((await api('/users/'+target.id+'/reset-password',{method:'PUT',body:{newPassword:password}})).status,403);
    }
    const outsider=await User.create(rawUser(999));assert.equal((await api('/users/'+outsider.id,{method:'DELETE'})).status,403);
    assert.equal((await api('/users/'+created.id,{method:'PUT',body:{role:'admin'}})).status,400);
    assert.equal((await api('/users/'+created.id,{method:'PUT',body:{active:false}})).status,400);
    assert.equal((await api('/users/'+created.id,{method:'PUT',body:{email:' ADMIN@ADMIN.COM '}})).status,400);
    assert.equal((await api('/auth/create',{actor:fixed.vendedor,body:{nome:'Outro',email:'other@example.test',password,role:'vendedor'}})).status,403);
  });
  await t.test('exclusão invalida JWT e preserva tokens e auditoria anteriores',async()=>{
    const current=await User.findById(created.id), oldToken=sessionFor(current);
    await Token.create({companyId:company.id,companyName:company.razaoSocial,createdBy:created.id,nfNumber:'000000101',tokenHash:hashToken('ABC123'),expiresAt:new Date(Date.now()+86400000)});
    const before=await Audit.countDocuments();
    assert.equal((await api('/users/'+created.id,{method:'DELETE'})).status,200);
    assert.equal((await api('/companies',{actor:oldToken})).status,401);
    assert.equal(await Token.countDocuments({createdBy:created.id}),1);assert.equal(await Audit.countDocuments(),before+1);
    assert.equal(await Audit.countDocuments({action:'DELETE_USER','info.userId':created.id}),1);
  });
  await t.test('50 usuários: registros legados contam, criação concorrente não excede e exclusão libera vaga',async()=>{
    await reset();await User.insertMany(Array.from({length:46},(_,i)=>rawUser(i)));
    const results=await Promise.all([createUser('last1@example.test'),createUser('last2@example.test')]);
    assert.deepEqual(results.map(x=>x.status).sort(),[201,409]);assert.equal(await User.countDocuments(),50);
    const blocked=results.find(x=>x.status===409);assert.equal(blocked.data.code,'demo_users_limit');assert.equal(blocked.data.limit.remaining,0);
    const allowed=results.find(x=>x.status===201);
    assert.equal((await api('/users/'+allowed.data.user.id,{method:'PUT',body:{name:'Último editado'}})).status,200);
    assert.equal((await api('/users/'+allowed.data.user.id,{method:'DELETE'})).status,200);
    assert.equal((await createUser('replacement@example.test')).status,201);
    assert.equal((await api('/auth/login',{actor:null,body:{email:'admin@admin.com',password:'123$qwer'}})).status,200);
  });
  await t.test('base acima de 50 preservada, consultas disponíveis e inativos não ocupam capacidade',async()=>{
    await reset();await User.insertMany(Array.from({length:48},(_,i)=>rawUser(i)));
    assert.equal((await createUser('over@example.test')).status,409);assert.equal(await User.countDocuments(),51);
    assert.equal((await api('/users')).status,200);
    await User.updateMany({email:{$regex:/^legacy/}},{$set:{active:false}});
    assert.equal((await createUser('active@example.test')).status,201);
    assert.equal((await readDemoLimits()).users.used,4);
  });
  await t.test('empresas: cadastro/edição, proteção inicial, unicidade e 50 sob concorrência',async()=>{
    await reset();const result=await api('/companies',{actor:fixed.vendedor,body:companyBody(1)});assert.equal(result.status,201);
    assert.equal(result.data.company.demoManaged,true);
    assert.equal((await api('/companies',{actor:fixed.vendedor,body:{...companyBody(2),demoManaged:false}})).status,400);
    assert.equal((await api('/companies/'+result.data.company._id,{method:'PUT',body:{razaoSocial:'Empresa editada'}})).status,200);
    assert.equal((await api('/companies/'+company.id,{method:'PUT',body:{razaoSocial:'Não permitido'}})).status,403);
    assert.equal((await api('/companies',{actor:fixed.vendedor,body:companyBody(1)})).status,409);
    await Company.insertMany(Array.from({length:47},(_,i)=>companyBody(i+10)));
    const results=await Promise.all([100,101,102].map(i=>api('/companies',{actor:fixed.vendedor,body:companyBody(i)})));
    assert.deepEqual(results.map(x=>x.status).sort(),[201,409,409]);assert.equal(await Company.countDocuments(),50);
    assert.equal(results.find(x=>x.status===409).data.code,'demo_companies_limit');
    assert.equal((await api('/companies/'+result.data.company._id,{method:'PUT',body:{razaoSocial:'Editável no limite'}})).status,200);
  });
  await t.test('tokens: dez emissões concorrentes globais entre contas/IPs, décima primeira recusada e sem provedores',async()=>{
    await reset();const extra=await createUser('extra@example.test');const actor=await User.findById(extra.data.user.id);
    const results=await Promise.all(Array.from({length:12},(_,i)=>generate(i%2?actor:fixed.vendedor,i%2?'whatsapp':'email')));
    assert.equal(results.filter(x=>x.status===200).length,10);assert.equal(results.filter(x=>x.status===429).length,2);
    assert.equal(await Token.countDocuments(),10);assert.equal((await readDemoLimits()).tokens.used,10);assert.equal(mail.mock.callCount(),0);
    for(const result of results.filter(x=>x.status===429)){assert.equal(result.data.code,'demo_tokens_daily_limit');assert.ok(result.headers.get('retry-after'));}
    for(const result of results.filter(x=>x.status===200)) {assert.equal(result.data.deliveryChannel,'screen');assert.match(result.data.token,/^[A-Z0-9]{6}$/);}
    const code=results.find(x=>x.status===200).data.token;
    assert.equal((await api('/tokens/verify',{actor:fixed.verificador,body:{token:code}})).status,200);
    assert.equal((await api('/tokens/verify',{actor:fixed.verificador,body:{token:code}})).status,400);
    assert.equal((await api('/tokens/unverified',{actor:fixed.verificador})).status,200);
    assert.equal((await api('/tokens/verified-today',{actor:fixed.verificador})).status,200);
    assert.equal((await generate()).status,429);
  });
  await t.test('cota persiste após reconexão e remoção de tokens, e renova pela data civil de São Paulo',async()=>{
    const savedUri=process.env.MONGO_URI;await mongoose.disconnect();await mongoose.connect(savedUri);await confirmDemoEnvironment();
    assert.equal((await readDemoLimits()).tokens.used,10);await Token.deleteMany({});assert.equal((await readDemoLimits()).tokens.used,10);
    assert.equal((await generate()).status,429);
    const {end}=demoDay();assert.equal((await readDemoLimits(new Date(end.getTime()+1000))).tokens.used,0);
    assert.equal(demoDay(new Date('2026-10-16T02:59:59Z')).day,'2026-10-15');assert.equal(demoDay(new Date('2026-10-16T03:00:00Z')).day,'2026-10-16');
    assert.equal(demoDay(new Date('2026-10-15T15:00:00Z')).end.toISOString(),'2026-10-16T03:00:00.000Z');
  });
  await t.test('primeiro contador considera tokens já existentes; falha anterior à persistência não consome',async()=>{
    await reset();const now=new Date();await createUniqueToken({companyId:company.id,companyName:company.razaoSocial,nfNumber:'000000101',createdBy:fixed.vendedor.id,expiresAt:new Date(Date.now()+86400000)});
    assert.equal((await readDemoLimits()).tokens.used,1);
    await assert.rejects(demoWrite('tokens',async session=>{await Token.create([{companyId:company.id,companyName:company.razaoSocial,nfNumber:'000000102',createdBy:fixed.vendedor.id,tokenHash:hashToken('FAIL12'),expiresAt:new Date(Date.now()+86400000)}],{session});throw new Error('falha antes do commit');},now));
    assert.equal(await Token.countDocuments(),1);assert.equal((await readDemoLimits()).tokens.used,1);
    assert.equal(await mongoose.connection.db.collection('demoquotas').countDocuments(),0);
  });
  await t.test('falha secundária de auditoria mantém token e cota; falha de cadastro não reserva capacidade',async()=>{
    await reset();const original=Audit.create;Audit.create=async()=>{throw new Error('auditoria indisponível');};
    try {assert.equal((await generate()).status,200);}finally{Audit.create=original;}
    assert.equal(await Token.countDocuments(),1);assert.equal((await readDemoLimits()).tokens.used,1);
    await assert.rejects(demoWrite('users',async session=>{await User.create([{...rawUser(1),demoManaged:true}],{session});throw new Error('rollback');}));
    assert.equal((await readDemoLimits()).users.used,3);
  });
  await t.test('colisões esgotadas abortam a transação sem consumir cota',async()=>{
    await reset();await Token.create({companyId:company.id,companyName:company.razaoSocial,createdBy:fixed.vendedor.id,nfNumber:'000000101',tokenHash:hashToken('ABC123'),expiresAt:new Date(Date.now()+86400000)});
    const utils=require('../dist/src/utils/tokenUtils'), original=utils.generateTokenPlain;
    utils.generateTokenPlain=()=> 'ABC123';
    try {assert.equal((await generate()).status,503);} finally {utils.generateTokenPlain=original;}
    assert.equal(await Token.countDocuments(),1);assert.equal((await readDemoLimits()).tokens.used,1);
  });
  await t.test('contador corrompido e datas legadas desconhecidas recusam emissões',async()=>{
    await reset();await mongoose.connection.db.collection('demoquotas').insertOne({_id:'tokens:'+demoDay().day,used:-1});
    await assert.rejects(readDemoLimits());assert.equal((await generate()).status,500);assert.equal(await Token.countDocuments(),0);
    await mongoose.connection.db.collection('demoquotas').deleteMany({});
    await mongoose.connection.db.collection('tokens').insertOne({tokenHash:hashToken('DATE12'),expiresAt:new Date(Date.now()+86400000)});
    await assert.rejects(readDemoLimits());assert.equal((await generate()).status,500);assert.equal(await Token.countDocuments(),1);
  });
  await t.test('código vencido não libera retirada mesmo com capacidade diária disponível',async()=>{
    await reset();await Token.create({companyId:company.id,companyName:company.razaoSocial,createdBy:fixed.vendedor.id,nfNumber:'000000101',tokenHash:hashToken('OLD123'),expiresAt:new Date(Date.now()-1000)});
    const result=await api('/tokens/verify',{actor:fixed.verificador,body:{token:'OLD123'}});assert.equal(result.status,400);assert.equal(result.data.code,'expired_token');
  });
  await t.test('cotas exigem autenticação; configuração divergente não libera escrita',async()=>{
    assert.equal((await api('/demo/limits',{actor:null})).status,401);
    process.env.DEMO_DB_NAME='other_demo';assert.equal((await createUser('denied@example.test')).status,503);process.env.DEMO_DB_NAME='quotas_demo';
    assert.equal((await api('/demo/limits')).status,200);
  });
  await t.test('standalone recusa transação sem deixar reserva ou registro parcial',async()=>{
    const {MongoMemoryServer}=require('mongodb-memory-server');const standalone=await MongoMemoryServer.create();const replUri=process.env.MONGO_URI;
    try {
      await mongoose.disconnect();process.env.MONGO_URI=standalone.getUri('quotas_demo');await mongoose.connect(process.env.MONGO_URI);
      await mongoose.connection.db.collection('demo_environment').insertOne({_id:'portal-tokens-demo-v1',purpose:'public-demo'});await confirmDemoEnvironment();
      await assert.rejects(demoWrite('users',async session=>(await User.create([{...rawUser(1),demoManaged:true}],{session}))[0]));
      assert.equal(await User.countDocuments(),0);assert.equal(await mongoose.connection.db.collection('demoquotas').countDocuments(),0);
    } finally {await mongoose.disconnect();await standalone.stop();process.env.MONGO_URI=replUri;await mongoose.connect(replUri);await confirmDemoEnvironment();}
  });
 });
