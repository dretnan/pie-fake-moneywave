const config = require('../config/config.server')
const router = require('express').Router()
const models = require('../models')
const _ = require('lodash')
const decodeToken = require('../helpers/decodeToken')
const uniqueKey = require('unique-key')

/**
 * Card to Any Vault (Bank, Wallet etc)
 * Directly charge a customer
 * https://moneywave-doc.herokuapp.com/index.html#card-to-account
 * 
 */
router.post('/v1/transfer', (req, res, next) => {
  let {
    firstname = null, lastname = null, email,
    phonenumber, apiKey, narration,
    medium = 'web', redirecturl = 'https://logicaladdress.com', amount,
    fee = '45', recipient = 'wallet',
    card_no = null,  cvv = null, expiry_year = null, expiry_month = null,
    charge_auth = '', pin = '', charge_with = null,
    sender_account_number = null, sender_bank = null
  } = req.body

  if(apiKey != 'ts_LieLieApiKey'){
    return res.status(400).json({
        "status": "failure",
        "message": "we don't like secrets"
    });
  }
  // TODO: Do Validation as done in moneywave
  let decodedToken = decodeToken(req.headers['authorization'] || 'invalid', 'ts_LieLieApiSecret');
  if(decodedToken && decodedToken.client.apiKey == 'ts_LieLieApiKey' &&
      decodedToken.exp > Date.now()){

        if(firstname && lastname && card_no && cvv && expiry_year && expiry_month && 
            !sender_account_number){
          //This is a card transactions
          card_no = card_no.replace(/ /g,'')
          return models.card.findOne({
            where: {
              card_no,
              cvv,
              expiry_year,
              expiry_month
            },
            attributes: {
              exclude: []
            }
          }).then(card => {
            console.log(card)
            if(card && card.id !== undefined) {
              if(card.card_is_valid){
                let charge = require("../helpers/serviceCharge")(amount, fee)
                const flutterChargeReference = uniqueKey(10, 'FakeMW')
                const merchantCommission = charge.merchantCommission
                const chargedFee = charge.chargedFee
                const moneywaveCommission = charge.moneywaveCommission //correct
                const netDebitAmount = charge.netDebitAmount
                const amountToSend = charge.amount //correct
                const amountToCharge = charge.amountToCharge //correct
                models.transaction.create({
                  id: uniqueKey(10, 'trx'),
                  firstName: firstname,
                  lastName: lastname,
                  phoneNumber: phonenumber,
                  flutterChargeReference,
                  chargedFee, merchantCommission,
                  moneywaveCommission, netDebitAmount,
                  amountToSend,amountToCharge,
                  chargedBytoken: req.headers['authorization'] || 'invalid'
                }).then((tranx) => {
                  console.log(tranx)
                })
                return res.status(200).json({
                  "status":"success",
                  "message": card.success_response,
                  "data":{
                  "transfer":
                        {"id":4998,
                        "type":"fund-wallet",
                        "firstName":firstname,
                        "lastName":lastname,
                        "phoneNumber": phonenumber,
                        "recipientPhone":null,
                        "isCardValidationSuccessful":false,
                        "isDeliverySuccessful":false,
                        "status":"started",
                        "medium":"web",
                        "ip":"54.196.45.207",
                        "exchangeRate":null,
                        amountToSend: amountToSend / 100,
                        amountToCharge: amountToCharge / 100,
                        "disburseCurrency":"NGN",
                        "chargeCurrency":"NGN",
                        "flutterChargeResponseCode":"02",
                        "flutterChargeResponseMessage":"Pending, Validation",
                        "flutterDisburseResponseMessage":null,
                        flutterChargeReference,
                        "flutterDisburseReference":null,
                        "flutterDisburseResponseCode":null,
                        merchantCommission: merchantCommission / 100,
                        moneywaveCommission: moneywaveCommission / 100,
                        netDebitAmount: netDebitAmount / 100,
                        chargedFee: chargedFee / 100,
                        "receiptNumber":null,
                        "redirectUrl":"https://logicaladdress.com",
                        "meta":"{\"walletURef\":0,\"chargeMethod\":\"VBVSECURECODE\"}",
                        "createdAt":"2017-03-14T09:56:05.000Z",
                        "updatedAt":"2017-03-14T09:56:08.000Z",
                        "deletedAt":null,
                        "userId":205,
                        "merchantId":140,
                        "beneficiaryId":13,
                        "accountId":null,
                        "cardId":378,
                        "account":null,
                        "pendingValidation":true},
                 }})
              }
              return res.status(401).json({ 
                status: "error",
                code: "INVALID_CARD",
                message: card.failure_response
              })
            } else {
              return res.status(401).json({ 
                status: "error",
                code: "INVALID_CARD",
                message: "Provided card is not a valid card"
              })
            }
          }).catch(error => {
            return res.status(error.status || 400).json({
              "status": "error",
              "code": "UNKNOWN_ERROR",
              message: error.message || 'Oops! Something went wrong',
            })
          })
        }

        if(firstname && lastname && charge_with && sender_account_number && 
            sender_bank && !card_no){
          //This is account to wallet, probably
          return res.status(200).json({ 
            status: "success"
          })
        }
        
    }else{
      return res.status(401).json({
        "status": "error",
        "message": "Your token as expired or doesn't exist, kindly request a \
           new one every 2hrs. See https://moneywave-doc.herokuapp.com/index.html#authentication"
      });
    }
})


 
module.exports = router