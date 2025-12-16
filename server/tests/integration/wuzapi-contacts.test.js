/**
 * Testes de integração para API de contatos do WUZAPI
 * 
 * Estes testes verificam a lógica de processamento de contatos
 * sem depender de uma conexão real com o WUZAPI
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

describe('WUZAPI Contacts Processing', () => {
  
  test('should extract phone number from WhatsApp JID', () => {
    const jid = '5511999999999@s.whatsapp.net';
    const phone = jid.split('@')[0];
    
    assert.strictEqual(phone, '5511999999999');
  });

  test('should handle LID format JID', () => {
    const jid = 'abc123@lid';
    const contact = {
      RedactedPhone: '+55 11 99999-9999'
    };
    
    let phone = jid.split('@')[0];
    
    if (jid.includes('@lid') && contact.RedactedPhone) {
      const cleanPhone = contact.RedactedPhone.replace(/[^\d]/g, '');
      if (cleanPhone.length >= 10) {
        phone = cleanPhone;
      }
    }
    
    // O número limpo deve ter 13 dígitos (55 + 11 + 999999999)
    assert.strictEqual(phone, '5511999999999');
  });

  test('should categorize JID formats correctly', () => {
    const contacts = {
      '5511999999999@s.whatsapp.net': { FullName: 'User 1' },
      '5511888888888@s.whatsapp.net': { FullName: 'User 2' },
      'abc123@lid': { FullName: 'User 3' },
      'xyz789@lid': { FullName: 'User 4' },
      'group@g.us': { FullName: 'Group' }
    };

    const jidFormats = {
      whatsapp: 0,
      lid: 0,
      other: 0
    };

    Object.keys(contacts).forEach(jid => {
      if (jid.includes('@s.whatsapp.net')) {
        jidFormats.whatsapp++;
      } else if (jid.includes('@lid')) {
        jidFormats.lid++;
      } else {
        jidFormats.other++;
      }
    });

    assert.strictEqual(jidFormats.whatsapp, 2);
    assert.strictEqual(jidFormats.lid, 2);
    assert.strictEqual(jidFormats.other, 1);
  });

  test('should extract contact name from various fields', () => {
    const contacts = [
      { FullName: 'Full Name', PushName: 'Push', FirstName: 'First', BusinessName: 'Business' },
      { PushName: 'Push Name', FirstName: 'First', BusinessName: 'Business' },
      { FirstName: 'First Name', BusinessName: 'Business' },
      { BusinessName: 'Business Name' },
      {}
    ];

    const getContactName = (contact) => {
      return contact.FullName || contact.PushName || contact.FirstName || contact.BusinessName || '(sem nome)';
    };

    assert.strictEqual(getContactName(contacts[0]), 'Full Name');
    assert.strictEqual(getContactName(contacts[1]), 'Push Name');
    assert.strictEqual(getContactName(contacts[2]), 'First Name');
    assert.strictEqual(getContactName(contacts[3]), 'Business Name');
    assert.strictEqual(getContactName(contacts[4]), '(sem nome)');
  });

  test('should count contacts with RedactedPhone', () => {
    const contacts = {
      'jid1': { RedactedPhone: '+55 11 9****-9999' },
      'jid2': { RedactedPhone: '+55 21 9****-8888' },
      'jid3': {},
      'jid4': { RedactedPhone: null },
      'jid5': { RedactedPhone: '+55 31 9****-7777' }
    };

    const withRedactedPhone = Object.values(contacts).filter(c => c.RedactedPhone).length;
    
    assert.strictEqual(withRedactedPhone, 3);
  });

  test('should validate phone number format', () => {
    const isValidPhone = (phone) => {
      const cleanPhone = phone.replace(/[^\d]/g, '');
      return cleanPhone.length >= 10 && cleanPhone.length <= 15;
    };

    assert.strictEqual(isValidPhone('5511999999999'), true);
    assert.strictEqual(isValidPhone('+55 11 99999-9999'), true);
    assert.strictEqual(isValidPhone('123'), false);
    assert.strictEqual(isValidPhone('12345678901234567890'), false);
  });
});
