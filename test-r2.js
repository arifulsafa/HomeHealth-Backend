import { S3Client, ListBucketsCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL;

console.log('\n🔍 Checking R2 Configuration...\n');
console.log('Environment Variables:');
console.log('  R2_ACCOUNT_ID:', accountId ? `✓ Set (${accountId.substring(0, 4)}...)` : '✗ Missing');
console.log('  R2_ACCESS_KEY_ID:', accessKeyId ? `✓ Set (${accessKeyId.substring(0, 8)}...)` : '✗ Missing');
console.log('  R2_SECRET_ACCESS_KEY:', secretAccessKey ? '✓ Set' : '✗ Missing');
console.log('  R2_BUCKET_NAME:', bucketName ? `✓ Set (${bucketName})` : '✗ Missing');
console.log('  R2_PUBLIC_URL:', publicUrl ? `✓ Set (${publicUrl})` : '✗ Missing');

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
  console.error('\n❌ ERROR: Missing required R2 environment variables!\n');
  console.log('Please check your .env file and ensure all R2 variables are set correctly.\n');
  console.log('IMPORTANT: R2_PUBLIC_URL should be your R2 bucket\'s public URL, NOT the API endpoint.');
  console.log('Example: https://pub-xxxxx.r2.dev or your custom domain\n');
  process.exit(1);
}

const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
console.log('\n  Endpoint:', endpoint);

const s3Client = new S3Client({
  region: 'auto',
  endpoint: endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

console.log('\n📡 Testing R2 Connection...\n');

// Test 1: List buckets
console.log('Test 1: Listing buckets...');
try {
  const listCommand = new ListBucketsCommand({});
  const listResponse = await s3Client.send(listCommand);
  console.log('✅ SUCCESS: Connection works!');
  console.log('   Available buckets:', listResponse.Buckets?.map(b => b.Name).join(', ') || 'None');
  
  const bucketExists = listResponse.Buckets?.some(b => b.Name === bucketName);
  if (!bucketExists) {
    console.log(`\n⚠️  WARNING: Bucket "${bucketName}" not found in your R2 account!`);
    console.log('   Available buckets:', listResponse.Buckets?.map(b => b.Name).join(', ') || 'None');
  }
} catch (error) {
  console.error('❌ FAILED:', error.message);
  console.error('\nDiagnosis:');
  if (error.code === 'EPROTO' || error.message.includes('SSL') || error.message.includes('handshake')) {
    console.error('  → SSL/TLS handshake failure');
    console.error('  → Your R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY is incorrect');
    console.error('  → Or your R2_ACCOUNT_ID is wrong');
    console.error('\nHow to fix:');
    console.error('  1. Go to Cloudflare Dashboard → R2');
    console.error('  2. Click "Manage R2 API Tokens"');
    console.error('  3. Create a new API token or verify existing one');
    console.error('  4. Update .env with correct credentials');
    console.error('  5. Verify R2_ACCOUNT_ID matches your Cloudflare Account ID');
  } else if (error.code === 'InvalidAccessKeyId') {
    console.error('  → R2_ACCESS_KEY_ID is invalid');
  } else if (error.code === 'SignatureDoesNotMatch') {
    console.error('  → R2_SECRET_ACCESS_KEY is incorrect');
  } else {
    console.error('  → Unknown error:', error.code || error.name);
  }
  process.exit(1);
}

// Test 2: Upload a test file
console.log('\nTest 2: Uploading a test file...');
try {
  const testData = Buffer.from('Test file from R2 diagnostic script');
  const testKey = `test-${Date.now()}.txt`;
  
  const uploadCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: testKey,
    Body: testData,
    ContentType: 'text/plain',
  });
  
  await s3Client.send(uploadCommand);
  console.log('✅ SUCCESS: File uploaded!');
  console.log('   File key:', testKey);
  console.log('   Public URL:', `${publicUrl}/${testKey}`);
} catch (error) {
  console.error('❌ FAILED:', error.message);
  console.error('\nDiagnosis:');
  if (error.code === 'NoSuchBucket') {
    console.error(`  → Bucket "${bucketName}" does not exist`);
    console.error('  → Create the bucket in Cloudflare R2 dashboard first');
  } else if (error.code === 'AccessDenied') {
    console.error('  → Your R2 API token does not have write permissions');
    console.error('  → Create a new token with "Edit" permissions');
  } else {
    console.error('  → Error code:', error.code || error.name);
  }
  process.exit(1);
}

console.log('\n✅ All tests passed! R2 is configured correctly.\n');
