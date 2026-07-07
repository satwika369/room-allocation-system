// ===== CONFIG =====
var VALID_BATCHES = ["PHD2025", "MTECH2025", "Batch2023", "Batch2024", "Batch2025"];
var ALLOWED_DOMAIN = "iitbhilai.ac.in";

// ===== SERVES THE WEB PAGE =====
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Room Allotment')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function nowFormatted() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd MMM yyyy, HH:mm:ss");
}

function isValidEmail(email) {
  if (!email || email.indexOf('@') === -1) return false;
  var domain = email.split('@')[1].toLowerCase().trim();
  return domain === ALLOWED_DOMAIN.toLowerCase();
}

// Safely gets a sheet, throws a clear error if the name doesn't match
function getSheetSafe(name) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) {
    throw new Error('Sheet tab "' + name + '" not found. Check your tab names match VALID_BATCHES exactly.');
  }
  return sheet;
}

// ===== CHECK IF THIS EMAIL ALREADY HAS A ROOM IN *ANY* BATCH =====
function findExistingBookingAnywhere(email) {
  var e = email.toLowerCase().trim();
  for (var b = 0; b < VALID_BATCHES.length; b++) {
    var sheet = getSheetSafe(VALID_BATCHES[b]);
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var occ1 = String(data[i][4]).toLowerCase().trim();
      var occ2 = String(data[i][5]).toLowerCase().trim();
      if (occ1 === e || occ2 === e) {
        return { batch: VALID_BATCHES[b], roomNo: data[i][0] };
      }
    }
  }
  return null;
}

// ===== CHECK IF CURRENT USER ALREADY HAS A ROOM IN THIS SPECIFIC BATCH =====
function checkMyBookingInBatch(batchSheetName, email) {
  if (VALID_BATCHES.indexOf(batchSheetName) === -1) {
    throw new Error('Invalid batch: ' + batchSheetName);
  }
  var sheet = getSheetSafe(batchSheetName);
  var data = sheet.getDataRange().getValues();
  var e = email.toLowerCase().trim();
  for (var i = 1; i < data.length; i++) {
    var occ1 = String(data[i][4]).toLowerCase().trim();
    var occ2 = String(data[i][5]).toLowerCase().trim();
    if (occ1 === e || occ2 === e) {
      return { roomNo: data[i][0], row: i + 1 };
    }
  }
  return null;
}

// ===== FETCH ROOMS WITH SPACE (0 or 1 occupant) =====
function getRooms(batchSheetName) {
  if (VALID_BATCHES.indexOf(batchSheetName) === -1) {
    throw new Error('Invalid batch: ' + batchSheetName);
  }
  var sheet = getSheetSafe(batchSheetName);
  var data = sheet.getDataRange().getValues();
  var rooms = [];
  for (var i = 1; i < data.length; i++) {
    var status = data[i][3];
    if (status === 'Available' || status === 'Partially Booked') {
      rooms.push({
        row: i + 1,
        roomNo: data[i][0],
        wing: data[i][1],
        level: data[i][2],
        status: status,
        occupant1: data[i][4] || null
      });
    }
  }
  return rooms;
}

// ===== BOOKING (handles 2 occupants + cross-batch duplicate check) =====
function bookRoom(batchSheetName, rowNumber, email) {
  if (!isValidEmail(email)) {
    return { success: false, message: 'Please use your official @' + ALLOWED_DOMAIN + ' email.' };
  }
  if (VALID_BATCHES.indexOf(batchSheetName) === -1) {
    return { success: false, message: 'Invalid batch.' };
  }

  var lock = LockService.getScriptLock();
  var gotLock = lock.tryLock(10000);
  if (!gotLock) {
    return { success: false, message: 'Server busy, please try again in a few seconds.' };
  }

  try {
    var existing = findExistingBookingAnywhere(email);
    if (existing) {
      return { success: false, message: 'You already booked Room ' + existing.roomNo + ' (' + existing.batch + '). Cancel it first if you want to change.' };
    }

    var sheet = getSheetSafe(batchSheetName);
    var occupant1 = sheet.getRange(rowNumber, 5).getValue();
    var occupant2 = sheet.getRange(rowNumber, 6).getValue();
    var roomNo = sheet.getRange(rowNumber, 1).getValue();

    if (occupant1 === '' || occupant1 === null) {
      sheet.getRange(rowNumber, 5).setValue(email);
      sheet.getRange(rowNumber, 7).setValue(nowFormatted());
      sheet.getRange(rowNumber, 4).setValue('Partially Booked');
      return { success: true, message: 'Room ' + roomNo + ' booked! Waiting for a second occupant.' };

    } else if (occupant2 === '' || occupant2 === null) {
      sheet.getRange(rowNumber, 6).setValue(email);
      sheet.getRange(rowNumber, 8).setValue(nowFormatted());
      sheet.getRange(rowNumber, 4).setValue('Full');
      return { success: true, message: 'Room ' + roomNo + ' booked! Room is now full (you + ' + occupant1 + ').' };

    } else {
      return { success: false, message: 'Sorry, this room just got full. Please pick another.' };
    }
  } finally {
    lock.releaseLock();
  }
}

// ===== CANCEL =====
function cancelBooking(batchSheetName, email) {
  if (VALID_BATCHES.indexOf(batchSheetName) === -1) {
    return { success: false, message: 'Invalid batch.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheetSafe(batchSheetName);
    var data = sheet.getDataRange().getValues();
    var e = email.toLowerCase().trim();

    for (var i = 1; i < data.length; i++) {
      var row = i + 1;
      var occ1 = String(data[i][4]).toLowerCase().trim();
      var occ2 = String(data[i][5]).toLowerCase().trim();

      if (occ1 === e) {
        if (occ2 !== '') {
          sheet.getRange(row, 5).setValue(data[i][5]);
          sheet.getRange(row, 7).setValue(data[i][7]);
          sheet.getRange(row, 6).setValue('');
          sheet.getRange(row, 8).setValue('');
          sheet.getRange(row, 4).setValue('Partially Booked');
        } else {
          sheet.getRange(row, 5).setValue('');
          sheet.getRange(row, 7).setValue('');
          sheet.getRange(row, 4).setValue('Available');
        }
        return { success: true, message: 'Booking cancelled.' };
      }
      if (occ2 === e) {
        sheet.getRange(row, 6).setValue('');
        sheet.getRange(row, 8).setValue('');
        sheet.getRange(row, 4).setValue('Partially Booked');
        return { success: true, message: 'Booking cancelled.' };
      }
    }
    return { success: false, message: 'No booking found to cancel.' };
  } finally {
    lock.releaseLock();
  }
}