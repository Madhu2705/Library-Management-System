import UserModel from "../models/user-model.js";
import {
  ErrorHandlerService,
  paginationService,
} from "../services/index.js";
import { studentValidationSchema } from "../services/validation-service.js";
import bcrypt from "bcrypt";
import DepartementModel from "../models/departement-model.js";
import BatchModel from "../models/batch-model.js";

class StudentController {
  async createStudent(req, res, next) {
    /* VALIDATE REQUEST */
    const { error } = studentValidationSchema.validate(req.body);
    if (error) {
      return next(error);
    }
    try {
      /* CHECK EMAIL OR ROLL NUMBER IS ALREADY EXIST (SHOULD BE UNIQUE) */
      const isEmailExist = await UserModel.findOne({ email: req.body.email });
      if (isEmailExist) {
        return next(
          ErrorHandlerService.alreadyExist("Email is already taken !")
        );
      }
      const isRollNumberExist = await UserModel.findOne({
        rollNumber: req.body.rollNumber,
      });
      if (isRollNumberExist) {
        return next(
          ErrorHandlerService.alreadyExist("Roll number is already exist")
        );
      }

      /* HASH PASSWORD PROVIDED BY ADMIN */
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      const student = new UserModel({ ...req.body, password: hashedPassword });
      await student.save();

      res.status(200).json({ student });
    } catch (error) {
      return next(error);
    }
  }

  async getStudents(req, res, next) {
    const { page, limit, skip } = paginationService(req);
    let totalPages;
    /* SEARCH QUERY */
    const regexQueryEmail = new RegExp(req.query.qEmail || "", "i");
    const regexQueryName = new RegExp(req.query.qName || "", "i");
    const regexQueryRollNumber = new RegExp(req.query.qRollNumber || "", "i");
    const filter = [
      { role: "Student" },
      { name: { $regex: regexQueryName } },
      { email: { $regex: regexQueryEmail } },
      { rollNumber: { $regex: regexQueryRollNumber } },
    ];

    try {
      const [students, totalRecords, batches, departements] = await Promise.all(
        [
          UserModel.find({ $and: filter }, "-__v -password")
            .sort({ createdAt: -1 })
            .populate("departement", "-__v -hod")
            .populate("batch", "-__v")
            .skip(skip)
            .limit(limit)
            .exec(),
          UserModel.countDocuments({ $and: filter }).exec(),
          BatchModel.find(),
          DepartementModel.find(),
        ]
      );
      totalPages = Math.ceil(totalRecords / limit);
      return res
        .status(200)
        .json({
          students,
          page,
          limit,
          totalRecords,
          totalPages,
          batches,
          departements,
        });
    } catch (error) {
      next(error);
    }
  }

  async getStudent(req, res, next) {
    const { _id } = req.params;
    try {
      const document = await UserModel.findById(_id, "-__v -password")
        .populate("departement", "-__v -hod")
        .populate("batch", "-__v");
      if (!document) {
        return next(ErrorHandlerService.notFound("Student not found"));
      }
      return res.status(200).json({ student: document });
    } catch (error) {
      next(error);
    }
  }

  async updateStudent(req, res, next) {
    const { _id } = req.params;
    try {
      /* VALIDATE REQEST */
      const { error } = studentValidationSchema.validate(req.body);
      if (error) {
        return next(error);
      }
      const document = await UserModel.findByIdAndUpdate(_id, req.body, {
        new: true,
      });
      if (!document) {
        return next(ErrorHandlerService.notFound("Student not found"));
      }

      return res.status(200).json({ student: document });
    } catch (error) {
      next(error);
    }
  }

  async deleteStudent(req, res, next) {
    const { _id } = req.params;
    try {
      const document = await UserModel.findByIdAndDelete(_id);
      if (!document) {
        return next(ErrorHandlerService.notFound("Student Not Found"));
      }
      res.status(204).json({ student: document });
    } catch (error) {
      next(error);
    }
  }

  async bulkUploadStudents(req, res, next) {
    try {
      const students = req.body.students;

      if (!Array.isArray(students) || students.length === 0) {
        return next(ErrorHandlerService.badRequest("Invalid student data"));
      }

      const results = {
        successful: 0,
        failed: 0,
        errors: [],
      };

      for (const studentData of students) {
        try {
          // Trim all string fields
          const cleanedData = {};
          for (const key in studentData) {
            if (typeof studentData[key] === "string") {
              cleanedData[key] = studentData[key].trim();
            } else {
              cleanedData[key] = studentData[key];
            }
          }

          /* VALIDATE REQUEST */
          const { error } = studentValidationSchema.validate(cleanedData);
          if (error) {
            results.failed++;
            results.errors.push({
              rollNumber: cleanedData.rollNumber || "N/A",
              name: cleanedData.name || "N/A",
              error: error.details[0].message,
            });
            continue;
          }

          /* CHECK EMAIL OR ROLL NUMBER IS ALREADY EXIST */
          const isEmailExist = await UserModel.findOne({
            email: cleanedData.email.toLowerCase(),
          });
          if (isEmailExist) {
            results.failed++;
            results.errors.push({
              rollNumber: cleanedData.rollNumber,
              name: cleanedData.name,
              error: "Email is already taken",
            });
            continue;
          }

          const isRollNumberExist = await UserModel.findOne({
            rollNumber: cleanedData.rollNumber,
          });
          if (isRollNumberExist) {
            results.failed++;
            results.errors.push({
              rollNumber: cleanedData.rollNumber,
              name: cleanedData.name,
              error: "Roll number already exists",
            });
            continue;
          }

          /* VALIDATE DEPARTEMENT AND BATCH BY NAME OR ID */
          let departementId;
          let batchId;

          // Try to find departement by ID first, if it fails, try by name
          const departement = await DepartementModel.findById(cleanedData.departement).catch(() => null);
          if (departement) {
            departementId = departement._id;
          } else {
            const departementByName = await DepartementModel.findOne({ name: cleanedData.departement });
            if (!departementByName) {
              results.failed++;
              results.errors.push({
                rollNumber: cleanedData.rollNumber,
                name: cleanedData.name,
                error: `Invalid departement: ${cleanedData.departement}`,
              });
              continue;
            }
            departementId = departementByName._id;
          }

          // Try to find batch by ID first, if it fails, try by name
          const batch = await BatchModel.findById(cleanedData.batch).catch(() => null);
          if (batch) {
            batchId = batch._id;
          } else {
            const batchByName = await BatchModel.findOne({ name: cleanedData.batch });
            if (!batchByName) {
              results.failed++;
              results.errors.push({
                rollNumber: cleanedData.rollNumber,
                name: cleanedData.name,
                error: `Invalid batch: ${cleanedData.batch}`,
              });
              continue;
            }
            batchId = batchByName._id;
          }

          /* HASH PASSWORD */
          const hashedPassword = await bcrypt.hash(cleanedData.password, 10);
          const student = new UserModel({
            ...cleanedData,
            email: cleanedData.email.toLowerCase(),
            password: hashedPassword,
            departement: departementId,
            batch: batchId,
            role: "Student",
          });
          await student.save();
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            rollNumber: studentData.rollNumber || "N/A",
            name: studentData.name || "N/A",
            error: error.message,
          });
        }
      }

      res.status(200).json(results);
    } catch (error) {
      next(error);
    }
  }

  async getSampleData(req, res, next) {
    try {
      const [departements, batches] = await Promise.all([
        DepartementModel.find().select("_id name").limit(1),
        BatchModel.find().select("_id name").limit(1),
      ]);

      if (!departements.length || !batches.length) {
        return next(
          ErrorHandlerService.badRequest(
            "No departements or batches found. Please create them first."
          )
        );
      }

      const departementId = departements[0]._id;
      const batchId = batches[0]._id;

      const sampleStudents = [
        {
          name: "Ahmed Hassan",
          fatherName: "Hassan Ahmed",
          email: "ahmed.hassan@example.com",
          rollNumber: "2023001",
          departement: departementId.toString(),
          batch: batchId.toString(),
          password: "Password123",
        },
        {
          name: "Sara Khan",
          fatherName: "Khan Muhammad",
          email: "sara.khan@example.com",
          rollNumber: "2023002",
          departement: departementId.toString(),
          batch: batchId.toString(),
          password: "Password123",
        },
        {
          name: "Ali Muhammad",
          fatherName: "Muhammad Ali",
          email: "ali.muhammad@example.com",
          rollNumber: "2023003",
          departement: departementId.toString(),
          batch: batchId.toString(),
          password: "Password123",
        },
        {
          name: "Fatima Ahmed",
          fatherName: "Ahmed Khalid",
          email: "fatima.ahmed@example.com",
          rollNumber: "2023004",
          departement: departementId.toString(),
          batch: batchId.toString(),
          password: "Password123",
        },
        {
          name: "Omar Hassan",
          fatherName: "Hassan Ibrahim",
          email: "omar.hassan@example.com",
          rollNumber: "2023005",
          departement: departementId.toString(),
          batch: batchId.toString(),
          password: "Password123",
        },
        {
          name: "Zainab Khan",
          fatherName: "Khan Karim",
          email: "zainab.khan@example.com",
          rollNumber: "2023006",
          departement: departementId.toString(),
          batch: batchId.toString(),
          password: "Password123",
        },
        {
          name: "Ibrahim Ali",
          fatherName: "Ali Rashid",
          email: "ibrahim.ali@example.com",
          rollNumber: "2023007",
          departement: departementId.toString(),
          batch: batchId.toString(),
          password: "Password123",
        },
        {
          name: "Amira Hassan",
          fatherName: "Hassan Samir",
          email: "amira.hassan@example.com",
          rollNumber: "2023008",
          departement: departementId.toString(),
          batch: batchId.toString(),
          password: "Password123",
        },
        {
          name: "Karim Ahmed",
          fatherName: "Ahmed Jamal",
          email: "karim.ahmed@example.com",
          rollNumber: "2023009",
          departement: departementId.toString(),
          batch: batchId.toString(),
          password: "Password123",
        },
        {
          name: "Noor Muhammad",
          fatherName: "Muhammad Hasan",
          email: "noor.muhammad@example.com",
          rollNumber: "2023010",
          departement: departementId.toString(),
          batch: batchId.toString(),
          password: "Password123",
        },
      ];

      res.status(200).json({ students: sampleStudents });
    } catch (error) {
      next(error);
    }
  }

}

export default new StudentController();
