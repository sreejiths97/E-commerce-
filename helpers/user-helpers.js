var db=require('../config/connection')
var collection=require('../config/collection')
const bcrypt=require('bcrypt')
var objectId=require('mongodb').ObjectId
const { resolve, reject, all } = require('promise')
const { USER_COLLECTION } = require('../config/collection')
const { response } = require('express')
const Razorpay=require('razorpay')


var instance = new Razorpay({
    key_id: 'rzp_test_CgrmolcKSZEK1W',
    key_secret: 'X9rpf1fC2PksAbaLdeSqM9zn',
  });



module.exports={
    doSignup:(userData)=>{
        return new Promise(async(resolve,reject)=>{
            userData.Password=await bcrypt.hash(userData.Password,10)
            db.get().collection(collection.USER_COLLECTION).insertOne(userData).then((data)=>{
                resolve(data) 
             
            })
       
    })
 },
 doLogin:(userData)=>{
     return new Promise(async(resolve,reject)=>{
         let loginStatus=false
         let response={}
         let user=await db.get().collection(collection.USER_COLLECTION).findOne({Email:userData.Email})
       
         if(user){

            bcrypt.compare(userData.Password,user.Password).then((status)=>{
                if(status){
                    console.log('login success');
                    response.user=user
                    response.status=true
                    resolve(response)
                }else{
                    console.log('login failed');
                    resolve({status:false})
                    
                }
            })

        }else{
            console.log('login failed');
        }
        })
 },
 addtoCart:(proId,userId)=>{
     let proObj={
         item:objectId(proId),
         quantity:1
     }
     return new Promise(async(resolve,reject)=>{
         let userCart=await db.get().collection(collection.CART_COLLECTION).findOne({user:objectId(userId)})
         if(userCart){
             let proExist=userCart.products.findIndex(product=>product.item==proId)
             if(proExist!=-1){
                 db.get().collection(collection.CART_COLLECTION).updateOne({
                     user:objectId(userId),'products.item':objectId(proId)},
                     {
                         $inc:{'products.$.quantity':1}
                     }
                     ).then(()=>{
                         resolve()
                     })
             }else{
             db.get().collection(collection.CART_COLLECTION)
             .updateOne({user:objectId(userId)},
             {
                     $push:{products:proObj}
                 
             } 
             ).then((response)=>{
                 resolve()

             })
            }
             
         }else{
             let cartObj={
                 user:objectId(userId),
                 products:[proObj]
             }
             db.get().collection(collection.CART_COLLECTION).insertOne(cartObj).then((response)=>{
                 resolve()
             })
         }


     })

 },
 getCartProducts:(userId)=>{
     return new Promise(async(resolve,reject)=>{
         let cartItems=await db.get().collection(collection.CART_COLLECTION).aggregate([
             {
                 $match:{user:objectId(userId)}
             },
             {
                 $unwind:'$products'
             },
             {
                 $project:{
                     item:'$products.item',
                     quantity:'$products.quantity'
                 }
             },
             {
                 $lookup:{
                     from:collection.PRODUCT_COLLECTION,
                     localField:'item',
                     foreignField:'_id',
                     as:'product'
                 }
             },
             {
                 $project:{
                     item:1,quantity:1,product:{$arrayElemAt:['$product',0]}
                 }
             }

            
         ]).toArray()
         
         resolve(cartItems)

     })
 },
 getCartCount:(userId)=>{
     return new Promise(async(resolve,reject)=>{
         count=0
         let cart=await db.get().collection(collection.CART_COLLECTION).findOne({user:objectId(userId)})
         if(cart){
             count=cart.products.length
         }
            resolve(count)
         
        
     })
 },
 changeProductQuantity:(details)=>{
     
    details.count=parseInt(details.count)
    details.quantity=parseInt(details.quantity)
    
     return new Promise((resolve,reject)=>{
         if(details.count==-1 && details.quantity==1){
             db.get().collection(collection.CART_COLLECTION)
             .updateOne({_id:objectId(details.cart)},
                {
                    $pull:{products:{item:objectId(details.product)}}
                }
             ).then((response)=>{
                 resolve({removeProduct:true})
             })

         }else{
        db.get().collection(collection.CART_COLLECTION).updateOne({
            _id:objectId(details.cart),'products.item':objectId(details.product)},
            {
                $inc:{'products.$.quantity':details.count}
            }
            ).then((response)=>{
                resolve({status:true})
            })
        }

     })
 },
 removeCartProduct:(dataremove)=>{
     return new Promise((resolve,reject)=>{
        db.get().collection(collection.CART_COLLECTION)
        .updateOne({_id:objectId(dataremove.cart)},
           {
               $pull:{products:{item:objectId(dataremove.product)}}
           }
        ).then((response)=>{
            resolve({removeProductcart:true})
        })

     })
 },
 getTotelAmount:(userId)=>{
    return new Promise(async(resolve,reject)=>{
        
        let totel=await db.get().collection(collection.CART_COLLECTION).aggregate([
            {
                $match:{user:objectId(userId)}
            },
            {
                $unwind:'$products'
            },
            
            {
                $project:{
                    item:'$products.item',
                    quantity:'$products.quantity'
                }
            },
            {
                $lookup:{
                    from:collection.PRODUCT_COLLECTION,
                    localField:'item',
                    foreignField:'_id',
                    as:'product'
                }
            },
            {
                $project:{
                    item:1,quantity:1,product:{$arrayElemAt:['$product',0]}
                }
            },
            {
                $group:{
                    _id:null,
                    totel:{$sum:{$multiply:[{$toInt:"$quantity"},{$toInt:"$product.Price"}]}}
                }
            }

           
        ]).toArray()
        if(totel==0){
            totel=0
            resolve(totel) 

        }else{
            resolve(totel[0].totel)
        }
         
               
            
       

    })

 },
 placeOrder:(order,products,totel)=>{
     return new Promise((resolve,reject)=>{
         console.log(order,products,totel);
         let status=order['payment-method']==='COD'?'placed':'pending'
         let orderObj={
             deliveryDetails:{
                 mobile:order.mobile,
                 address:order.address,
                 pincode:order.pincode
             
                },
                userId:objectId(order.userId),
                paymentMethod:order['payment-method'],
                products:products,
                totelAmount:totel,
                status:status,
                date: new Date()

        }
        db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response)=>{
            
            resolve(response.insertedId)
            //db.get().collection(collection.CART_COLLECTION).remove({user:objectId(order.userId)})
            
        })

     })

 },
 getCartProductList:(userId)=>{
     return new Promise(async(resolve,reject)=>{
         let cart=await db.get().collection(collection.CART_COLLECTION).findOne({user:objectId(userId)})
         resolve(cart.products)
     })
 },
 getUserOrder:(userId)=>{
     return new Promise(async(resolve,reject)=>{
         let orders= await db.get().collection(collection.ORDER_COLLECTION).find({userId:objectId(userId)}).toArray()
         resolve(orders)
     })
 },
 getOrderProducts:(orderId)=>{
     
    return new Promise(async(resolve,reject)=>{
        let orderItems=await db.get().collection(collection.ORDER_COLLECTION).aggregate([
            {
                $match:{_id:objectId(orderId)}
            },
            {
                $unwind:'$products'
            },
            {
                $project:{
                    item:'$products.item',
                    quantity:'$products.quantity'
                }
            },
            {
                $lookup:{
                    from:collection.PRODUCT_COLLECTION,
                    localField:'item',
                    foreignField:'_id',
                    as:'product'
                }
            },
            {
                $project:{
                    item:1,quantity:1,product:{$arrayElemAt:['$product',0]}
                }
            }

           
        ]).toArray()
      
        resolve(orderItems)

    })

 },
 generateRazorpay:(orderId,totel)=>{
     return new Promise ((resolve,reject)=>{

        var options = {
          amount: totel*100,  // amount in the smallest currency unit
          currency: "INR",
          receipt: ""+orderId
        };
        instance.orders.create(options, function(err, order) {
          if(err){
              console.log(err);
          }else{
            console.log("sreejith:",order);
            resolve(order)

          }
      
        });
     })
 },
 verifyPayment:(details)=>{
     console.log("sreeeeeeeeeeeeeeee",details);
     return new Promise((resolve,reject)=>{
        const crypto = require('crypto');
        
         let hmac = crypto.createHmac('sha256','X9rpf1fC2PksAbaLdeSqM9zn');
         

         hmac.update(details['payment[razorpay_order_id]']+'|'+details['payment[razorpay_payment_id]']);
       
         hmac=hmac.digest('hex')
         console.log("sreeeee",hmac);
         
         if(hmac==details['payment[razorpay_signature]']){
             resolve()
         }else{
             reject()
         }


     })
 },
 chaangePaymentStatus:(orderId)=>{
     console.log('sreejith',orderId);
     return new Promise((resolve,reject)=>{
         db.get().collection(collection.ORDER_COLLECTION).updateOne({_id:objectId(orderId)},
         {
             $set:{
                 status:'placed'
             }
         }
         ).then(()=>{
             resolve()
         })
        
        })

    }

}







