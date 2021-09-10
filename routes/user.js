const { response } = require('express');
var express = require('express');
const session = require('express-session');
var router = express.Router();
var productHelpers=require('../helpers/product-helpers')
var userHelpers=require('../helpers/user-helpers')

const verifyLogin=(req,res,next)=>{
  if(req.session.userloggedIn){
    next()
  }else{
    res.redirect('/login')
  }
}

/* GET home page. */
router.get('/',async function(req, res, next) {
  let user=req.session.user
  let cartCount=null
  if(req.session.user){
  cartCount=await userHelpers.getCartCount(req.session.user._id)
  }
  
  
  productHelpers.getAllProduct().then((products)=>{
   
    res.render('user/view-products',{products,user,cartCount});
  })
});
router.get('/login',(req,res)=>{
  if(req.session.userloggedIn){
    res.redirect('/')
  }else{
    res.render('user/login',{"loginErr":req.session.userLoginErr})
    req.session.userLoginErr=false
  }
})
router.get('/signup',(req,res)=>{
  res.render('user/signup')
})
router.post('/signup',(req,res)=>{
  userHelpers.doSignup(req.body).then((response)=>{
    
    req.session.user=response
    req.session.userloggedIn=true

    res.redirect('/')
  })

})
router.post('/login',(req,res)=>{
  userHelpers.doLogin(req.body).then((response)=>{
    if(response.status){
     
      req.session.user=response.user
      req.session.userloggedIn=true
      res.redirect('/')
    }else{
      req.session.userLoginErr="invalid username or passord"
      res.redirect('/login')

    }
  })

})
router.get('/logout',(req,res)=>{
  req.session.user=null
  res.redirect('/')
})

router.get('/cart',verifyLogin,async(req,res)=>{
  let products=await userHelpers.getCartProducts(req.session.user._id)
  let totalValue=await userHelpers.getTotelAmount(req.session.user._id)
  console.log(products);
  res.render('user/cart',{products,user:req.session.user,totalValue})
})
router.get('/add-to-cart/:id',verifyLogin,(req,res)=>{
  userHelpers.addtoCart(req.params.id,req.session.user._id).then(()=>{
    res.json({status:true})
  })

})
router.post('/change-product-quantiy',(req,res)=>{
  userHelpers.changeProductQuantity(req.body).then(async(response)=>{
    response.totel=await userHelpers.getTotelAmount(req.body.user)
    res.json(response)
    
  })
})
router.post('/remove-product',(req,res)=>{
  userHelpers.removeCartProduct(req.body).then((response)=>{
    
    res.json(response)
  })
})
router.get('/place-order',verifyLogin,async(req,res)=>{
  let totel=await userHelpers.getTotelAmount(req.session.user._id)
  res.render('user/place-order',{totel,user:req.session.user})
})

router.post('/place-order',async(req,res)=>{
  let products=await userHelpers.getCartProductList(req.body.userId)
  let totelPrice=await userHelpers.getTotelAmount(req.body.userId)
  userHelpers.placeOrder(req.body,products,totelPrice).then((orderId)=>{
   if(req.body['payment-method']=='COD'){
    res.json({codSuccess:true})
   }else{
     userHelpers.generateRazorpay(orderId,totelPrice).then((response)=>{
      res.json(response)
     })
   }
    
  })
  console.log(req.body)
})
router.get('/confirm-order',verifyLogin,(req,res)=>{
  res.render('user/confirm-order',{user:req.session.user})
})

router.get('/order-list',verifyLogin,async(req,res)=>{
  let orders= await userHelpers.getUserOrder(req.session.user._id)
  res.render('user/order-list',{user:req.session.user,orders})

 
})
router.get('/view-order-products/:id',async(req,res)=>{
 
  let products=await userHelpers.getOrderProducts(req.params.id)
  res.render('user/view-order-products',{user:req.session.user,products})
})

router.post('/verify-payemt',(req,res)=>{
  console.log(req.body);
  userHelpers.verifyPayment(req.body).then(()=>{
    userHelpers.chaangePaymentStatus(req.body['order[receipt]']).then(()=>{
      res.json({status:true})

    })
  }).catch((err)=>{
    res.json({status:false,errMsg:''})
  
})
})

module.exports = router;



