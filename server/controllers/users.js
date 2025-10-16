const { sendOTPValidator, verifyEmailValidator, loginValidator, feedbackValidator, resetMailValidator, resetPassValidator } = require("../validators/joi-validator")
const User = require('../models/User')
const { generateOTP } = require("../Utils/generateOTP")
const passwordHash = require('password-hash')
const jwt = require('jsonwebtoken')
const sendEmail = require('../Utils/sendEmail')
const sendEmail2 = require('../Utils/sendEmail2')
const webpush = require('web-push')
const { instance } = require("../Utils/razorPayInstance")


exports.sendOTP = async (req, res) => {
  req.body.otp = "1";
  const { error } = sendOTPValidator.validate(req.body);
  console.log(error);

  try {
    if (error) return res.status(400).json({ msg: error.details[0].message });

    const { email, password, confirmPassword, firstName, lastName, userName, mobileNo, selectedImg, currTimeStamp } = req.body;

    // Usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "User already exists" });

    // Passwords iguales
    if (password !== confirmPassword) return res.status(400).json({ msg: "Password don't match" });

    // Hash y OTP
    const hashedPassword = passwordHash.generate(password);
    const otpGenerated = generateOTP();

    // 🔐 DEV: mostrar OTP en consola
    console.log("🔐 OTP dev:", otpGenerated);

    // Crear usuario no verificado
    const newUser = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      userName,
      mobileNo,
      profilePic: selectedImg,
      createdAt: new Date(currTimeStamp).toISOString(),
      otp: otpGenerated
    });

    if (!newUser) return res.status(500).json({ msg: "Unable to sign up please try again later" });

    // (DEV) No mandamos correo real mientras pruebas
    // const subject = "[Smart Parking] Welcome smart parker";
    // const html = `Welcome... ${otpGenerated}`;
    // await sendEmail2({ html, subject, receiverMail: email });

    // DEV: Devolver OTP en la respuesta para probar rápido
    return res.status(200).json({
      msg: "Account created (DEV). OTP is in server console.",
      devOTP: otpGenerated
    });
  } catch (err) {
    return res.status(500).json({ msg: "Something went wrong.." });
  }
};


exports.resendOTP = async(req,res)=>{
    console.log(req.body)

    try{
        if(!req.body.email){
            return res.status(200).json({msg:"Please enter email"})
        }

        //check if the user already exists
        const existingUser = await User.findOne({ email: req.body.email })

        //if user already exists simply return
        if (!existingUser) {
            return res.status(400).json({ msg: "No account with this email ID, Create an Account first" })
        }else if(existingUser.verified){
            return res.status(200).json({msg: "You are already verified, you can login directly"})
        }

       //generate otp
       const otpGenerated = generateOTP();
       console.log("otp generated", otpGenerated)

       if(!otpGenerated){
        return res.status(400).json({msg:"Error in generating OTP"})
       }

       //send email to user with otp
       const subject = "[Smart Parking] Welcome smart parker"
        const html = `
            Welcome to the club
            You are just one step away from becoming a smart parker
                Please enter the sign up OTP to get started
                            ${otpGenerated}
            If you haven't made this request. simply ignore the mail and no changes will be made`
        const receiverMail = req.body.email
        await sendEmail2({html,subject,receiverMail})

        //store otp in user schema
        await User.findByIdAndUpdate(existingUser._id,{otp:otpGenerated})
        
        return res.status(200).json({msg:"Vefiy OTP sent to your email To Access Your Account"})

    }catch(err){
        return res.status(500).json({ msg: "Something went wrong.." })
    }
}

exports.verifyEmail = async (req, res) => {
    console.log(req.body)

    const { error } = verifyEmailValidator.validate(req.body);

    try {
        const { email, otp } = req.body;

        //check if user even exists or not
        const user = await User.findOne({ email })
       
        if (!user) {
            return res.status(400).json({ msg: "Fill all the details first" })
        }
        console.log(user.otp, " and ", otp)
        //check if received and generated otp's are same
        if (user && user.otp !== otp) {
            return res.status(400).json({ msg: "Invalid OTP" })
        }

        //updating user as verified
        const updatedUser = await User.findByIdAndUpdate(user._id, { verified: true })

        return res.status(200).json({ msg: "You're Registered Successfully, Login Now"  })
    } catch (err) {
        return res.status(500).json({ msg: "Something went wrong.." })
    }
}

exports.signIn = async (req, res) => {
    const { email, password } = req.body;
    const { error } = loginValidator.validate({ email, password });

    try {
        if (error)
            return res.status(400).json({ msg: error.details[0].message });

        // Verificar si el usuario existe
        const oldUser = await User.findOne({ email });
        if (!oldUser)
            return res.status(404).json({ msg: "User doesn't exist" });

        // Verificar si el usuario está verificado
        if (!oldUser.verified)
            return res.status(400).json({ msg: "Please verify your account first!" });

        // Verificar si la contraseña es correcta
        const isMatch = passwordHash.verify(password, oldUser.password);
        if (!isMatch)
            return res.status(400).json({ msg: "Invalid credentials" });

        // Si todo está bien, firmar el token
        const payload = {
            email: oldUser.email,
            id: oldUser._id,
            role: oldUser.role,
        };

        // Generar el token
        const token = jwt.sign(payload, process.env.TOKEN_SECRET, { expiresIn: "3h" });

        return res.status(200).json({ token });  // Asegúrate de enviar el token en la respuesta
    } catch (err) {
        return res.status(500).json({ msg: "Something went wrong.." });
    }
};




exports.getCurrentUser = async (req, res) => {
    console.log("loading user")
    try {
        if (!req.userId) {
            return res.status(401).json({ msg: "Unauthorized" })
        }
        
        //load the user from id and send to frontend
        const user = await User.findById(req.userId)
        return res.status(200).json({ firstName: user.firstName, lastName: user.lastName, userName: user.userName, _id: user._id, email: user.email, mobileNo: user.mobileNo, role: user.role, profilePic: user.profilePic })
    } catch (err) {
        return res.status(500).json({ msg: "Something went wrong.." })
    }
}

exports.sendFeedback = async (req, res) => {
    const { error } = feedbackValidator.validate(req.body);
    try {
        if (error) {
            return res.status(400).json({ msg: error.details[0].message, severity: "error" });
        }

        // Enviar correo electrónico con el feedback
        const receiverMail = 'smartparking678@gmail.com';
        const html = `${req.body.feedback}`;
        const subject = `Feedback from ${req.body.firstName} ${req.body.lastName}`;

        // Llamar a la función sendEmail2 para enviar el correo
        await sendEmail2({ html, subject, receiverMail });

        return res.status(200).json({ msg: "Feedback submitted successfully" });
    } catch (err) {
        return res.status(500).json({ msg: "Something went wrong.." });
    }
}


exports.setProfilePic = async (req, res) => {
    if (!req.userId)
        return res.status(401).json({ msg: "Unauthorized" })

    try {
        
        if (!req.body.selectedImg) {
            return res.status(400).json({ msg: "Please upload a picture first" })
        }

        ///update profilePic with selectedImg
        await User.findByIdAndUpdate(req.userId, { profilePic: req.body.selectedImg })
        return res.status(200).json({ msg: "Profile image updated succesfully" })
    } catch (err) {
        return res.status(500).json({ msg: "Something went wrong.." })
    }
}

exports.sendSubcription = async (req, res) => {
    if (!req.userId) {
        return res.status(201).json({ msg: "Unauthorized" })
    }
    try {
        console.log(req.body)
        const subcriptionData = req.body;
        console.log(subcriptionData)
        
        //save the subscription data received in user schema
        const updatedUser = await User.findOneAndUpdate({ _id: req.userId }, { subscription: subcriptionData }, { new: true })
       
        return res.status(200).json({ 'success': true })
    } catch (e) {
        return res.status(500).json({ msg: "Something went wrong.." })
    }
}

exports.sendResetEmail = async (req, res) => {
    const { error } = resetMailValidator.validate(req.body)
    try {
        if (error)
            return res.status(400).json({ msg: error.details[0].message })

        //check if user exists with this email
        const currUser = await User.findOne({ email: req.body.email })
        if (!currUser) {
            return res.status(404).json({ msg: "No user exists with this email, create an account first" })
        }

        const payload = {
            email: currUser.email,
            id: currUser._id
        }
        //create a token to authrize user to reset password
        const resetCode = jwt.sign(payload, process.env.TOKEN_SECRET, { expiresIn: "30m" })
        const subject = "[Smart Parker] Link to Reset Your Password"

        //send email to user with the code appended to link
        const html = `
                        To reset Your password follow the link below:
                        Reset Your password
                        ${process.env.REACT_APP_URL || "http://localhost:3000"}/resetPassword/${resetCode}
                        If you haven't made this request. simply ignore the mail and no changes will be made
        `
        const receiverMail = req.body.email

        console.log(receiverMail)
    
        await sendEmail2({ html, subject, receiverMail })


        return res.status(200).json({ msg: "Mail sent with link to reset Your password" })
    } catch (err) {
        return res.status(500).json({ msg: "Something went wrong.." })
    }
}

//when user clicks on the link sent to reset password and fill new password and sends requests
exports.resetPassword = async (req, res) => {
    const { error } = resetPassValidator.validate(req.body)
    try {
        if (error)
            return res.status(400).json({ msg: error.details[0].message })

        const {code,confirmPassword,password,currTimeStamp} = req.body
    
        //check if passwords match
        if (password !== confirmPassword) {
            console.log("No match")
            return res.status(400).json({ msg: "Password don't match" })
        }

        //decode the token used
        const decodedData = jwt.decode(code)

        //if token is expired 
        if(decodedData.exp*1000<currTimeStamp){
            return res.status(400).json({msg:"Expired code, send an email again to get a new code"})
        }

        //hash the new password
        const hashedPassword = passwordHash.generate(password)

        //save the updated new password
        await User.findByIdAndUpdate(decodedData.id,{password:hashedPassword})

        return res.status(200).json({msg:"Password reset successfully, you can login now with new password!"})
    } catch (err) {
        return res.status(500).json({ msg: "Something went wrong.." })
    }
}