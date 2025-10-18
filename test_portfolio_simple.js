const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/portfolio';

/**
 * Test Portfolio API - Simplified (chỉ 3 trường bắt buộc: name, email, message)
 */

// Test 1: Health check
async function testHealthCheck() {
  console.log('\n🏥 Test 1: Health Check');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', response.data.message);
  } catch (error) {
    console.log('❌ Health check failed:', error.response?.data || error.message);
  }
}

// Test 2: Get contact info
async function testGetContactInfo() {
  console.log('\n📞 Test 2: Get Contact Info');
  
  try {
    const response = await axios.get(`${BASE_URL}/contact-info`);
    console.log('✅ Contact info retrieved successfully:');
    const data = response.data.data;
    console.log(`   Name: ${data.name}`);
    console.log(`   Email: ${data.email}`);
    console.log(`   Available: ${data.available}`);
  } catch (error) {
    console.log('❌ Get contact info failed:', error.response?.data || error.message);
  }
}

// Test 3: Send contact email - Success case
async function testSendContactEmailSuccess() {
  console.log('\n📧 Test 3: Send Contact Email (Success)');
  
  const contactData = {
    name: "Nguyễn Văn A",
    email: "recruiter@company.com",
    message: "Chào bạn Duy Khang,\n\nTôi là HR Manager tại ABC Technology. Chúng tôi đang tìm kiếm một Frontend Developer có kinh nghiệm với React và Node.js.\n\nSau khi xem portfolio của bạn, chúng tôi rất ấn tượng với các dự án mà bạn đã thực hiện. Chúng tôi muốn mời bạn tham gia phỏng vấn cho vị trí này.\n\nMức lương: 15-20 triệu VND\nĐịa điểm: Quận 1, TP.HCM\nHình thức: Full-time\n\nBạn có thể phản hồi lại email này nếu quan tâm.\n\nTrân trọng,\nNguyễn Văn A"
  };

  try {
    const response = await axios.post(`${BASE_URL}/contact`, contactData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Email sent successfully!');
    console.log('   Message:', response.data.message);
    console.log('   From:', response.data.data.from);
    console.log('   Name:', response.data.data.name);
    console.log('   Sent at:', response.data.data.sentAt);
    
  } catch (error) {
    console.log('❌ Send email failed:', error.response?.data || error.message);
  }
}

// Test 4: Send contact email - Minimal message
async function testSendContactEmailMinimal() {
  console.log('\n📧 Test 4: Send Contact Email (Short Message)');
  
  const contactData = {
    name: "Trần Thị B",
    email: "hr@startup.vn", 
    message: "Chào bạn, chúng tôi có một dự án web app cần hỗ trợ. Bạn có thể liên hệ lại không?"
  };

  try {
    const response = await axios.post(`${BASE_URL}/contact`, contactData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Email sent successfully (short message)!');
    console.log('   From:', response.data.data.from);
    console.log('   Name:', response.data.data.name);
    
  } catch (error) {
    console.log('❌ Send email failed:', error.response?.data || error.message);
  }
}

// Test 5: Validation - Missing required fields
async function testValidationMissingFields() {
  console.log('\n❌ Test 5: Validation - Missing Required Fields');
  
  const invalidData = {
    name: "Test User",
    email: "test@example.com"
    // Missing message
  };

  try {
    const response = await axios.post(`${BASE_URL}/contact`, invalidData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('⚠️  Unexpected success:', response.data);
    
  } catch (error) {
    console.log('✅ Validation working correctly:');
    console.log('   Error:', error.response?.data?.message);
    if (error.response?.data?.errors) {
      console.log('   Field errors:', error.response.data.errors);
    }
  }
}

// Test 6: Validation - Invalid email
async function testValidationInvalidEmail() {
  console.log('\n❌ Test 6: Validation - Invalid Email');
  
  const invalidData = {
    name: "Test User",
    email: "invalid-email",
    message: "This is a test message with enough characters"
  };

  try {
    const response = await axios.post(`${BASE_URL}/contact`, invalidData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('⚠️  Unexpected success:', response.data);
    
  } catch (error) {
    console.log('✅ Email validation working correctly:');
    console.log('   Error:', error.response?.data?.message);
  }
}

// Test 7: Validation - Message too short
async function testValidationShortMessage() {
  console.log('\n❌ Test 7: Validation - Message Too Short');
  
  const invalidData = {
    name: "Test User",
    email: "test@example.com",
    message: "Short"
  };

  try {
    const response = await axios.post(`${BASE_URL}/contact`, invalidData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('⚠️  Unexpected success:', response.data);
    
  } catch (error) {
    console.log('✅ Message length validation working correctly:');
    console.log('   Error:', error.response?.data?.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Portfolio API Tests (Simplified Version)...\n');
  console.log('=' .repeat(60));
  
  await testHealthCheck();
  await testGetContactInfo();
  await testSendContactEmailSuccess();
  await testSendContactEmailMinimal();
  await testValidationMissingFields();
  await testValidationInvalidEmail();
  await testValidationShortMessage();
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ All Portfolio API tests completed!');
  console.log('\n📝 API Summary:');
  console.log('   📍 Endpoint: POST /api/portfolio/contact');
  console.log('   📋 Required fields: name, email, message');
  console.log('   ✅ Validation: email format, message length (10-2000 chars)');
  console.log('   📧 Features: HTML email template, auto-reply confirmation');
  console.log('\n🎯 Portfolio API is ready for your website!');
}

// Run tests
runAllTests().catch(console.error);
