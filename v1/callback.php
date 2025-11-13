<?php
// Callback URL for M-Pesa STK Push
header('Content-Type: application/json');

// Log the callback data for debugging
$callbackData = file_get_contents('php://input');
file_put_contents('mpesa_callback.log', date('Y-m-d H:i:s') . " - " . $callbackData . "\n", FILE_APPEND);

// Parse the callback data
$data = json_decode($callbackData, true);

if ($data) {
    // Extract relevant information from the callback
    $merchantRequestID = $data['Body']['stkCallback']['MerchantRequestID'] ?? '';
    $checkoutRequestID = $data['Body']['stkCallback']['CheckoutRequestID'] ?? '';
    $resultCode = $data['Body']['stkCallback']['ResultCode'] ?? '';
    $resultDesc = $data['Body']['stkCallback']['ResultDesc'] ?? '';
   
    // Log the result
    file_put_contents('mpesa_results.log', date('Y-m-d H:i:s') . " - MerchantRequestID: $merchantRequestID, CheckoutRequestID: $checkoutRequestID, ResultCode: $resultCode, ResultDesc: $resultDesc\n", FILE_APPEND);
   
    if ($resultCode == 0) {
        // Payment was successful
        $callbackMetadata = $data['Body']['stkCallback']['CallbackMetadata']['Item'] ?? [];
       
        $amount = '';
        $mpesaReceiptNumber = '';
        $transactionDate = '';
        $phoneNumber = '';
       
        foreach ($callbackMetadata as $item) {
            if ($item['Name'] == 'Amount') {
                $amount = $item['Value'] ?? '';
            } elseif ($item['Name'] == 'MpesaReceiptNumber') {
                $mpesaReceiptNumber = $item['Value'] ?? '';
            } elseif ($item['Name'] == 'TransactionDate') {
                $transactionDate = $item['Value'] ?? '';
            } elseif ($item['Name'] == 'PhoneNumber') {
                $phoneNumber = $item['Value'] ?? '';
            }
        }
       
        // Log successful transaction details
        file_put_contents('successful_transactions.log', date('Y-m-d H:i:s') . " - Success: Amount: $amount, Receipt: $mpesaReceiptNumber, Date: $transactionDate, Phone: $phoneNumber\n", FILE_APPEND);
       
        // Here you can update your database, send confirmation emails, etc.
       
    } else {
        // Payment failed
        file_put_contents('failed_transactions.log', date('Y-m-d H:i:s') . " - Failed: ResultCode: $resultCode, Description: $resultDesc\n", FILE_APPEND);
    }
   
    // Send response to M-Pesa
    echo json_encode(['ResultCode' => 0, 'ResultDesc' => 'Callback processed successfully']);
} else {
    // Invalid callback data
    file_put_contents('mpesa_errors.log', date('Y-m-d H:i:s') . " - Invalid callback data received\n", FILE_APPEND);
    echo json_encode(['ResultCode' => 1, 'ResultDesc' => 'Invalid callback data']);
}
?>